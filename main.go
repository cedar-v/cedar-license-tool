package main

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"embed"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

// RSAPrivateKey RSA私钥结构
type RSAPrivateKey struct {
	*rsa.PrivateKey
}

// LoadRSAPrivateKeyFromString 从PEM字符串加载RSA私钥
func LoadRSAPrivateKeyFromString(privKeyStr string) (*RSAPrivateKey, error) {
	block, _ := pem.Decode([]byte(privKeyStr))
	if block == nil {
		return nil, errors.New("无法解析PEM格式的私钥")
	}

	var key *rsa.PrivateKey
	var errParse error

	key, errParse = x509.ParsePKCS1PrivateKey(block.Bytes)
	if errParse != nil {
		parsedKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("解析私钥失败: %w", err)
		}
		var ok bool
		key, ok = parsedKey.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("不是有效的RSA私钥")
		}
	}

	return &RSAPrivateKey{PrivateKey: key}, nil
}

// SignData 使用RSA私钥对数据进行数字签名
func (key *RSAPrivateKey) SignData(data []byte) (string, error) {
	hashed := sha256.Sum256(data)
	signature, err := rsa.SignPSS(rand.Reader, key.PrivateKey, crypto.SHA256, hashed[:], &rsa.PSSOptions{
		SaltLength: rsa.PSSSaltLengthEqualsHash,
		Hash:       crypto.SHA256,
	})
	if err != nil {
		return "", fmt.Errorf("签名失败: %w", err)
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

// GenerateRSAKeyPairInMemory 在内存中生成RSA密钥对，返回PEM格式字符串
func GenerateRSAKeyPairInMemory(keySize int) (string, string, error) {
	if keySize < 2048 {
		keySize = 2048
	}

	privateKey, err := rsa.GenerateKey(rand.Reader, keySize)
	if err != nil {
		return "", "", fmt.Errorf("生成RSA密钥对失败: %w", err)
	}

	privPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	})

	publicKeyBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		return "", "", fmt.Errorf("序列化公钥失败: %w", err)
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyBytes,
	})

	return string(privPEM), string(pubPEM), nil
}

// SaveKeyPair 保存密钥对到文件
func SaveKeyPair(dir string, privateKeyPEM, publicKeyPEM string) error {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("创建密钥目录失败: %w", err)
	}

	privateKeyPath := filepath.Join(dir, "license_private.pem")
	if err := os.WriteFile(privateKeyPath, []byte(privateKeyPEM), 0600); err != nil {
		return fmt.Errorf("保存私钥失败: %w", err)
	}

	publicKeyPath := filepath.Join(dir, "license_public.pem")
	if err := os.WriteFile(publicKeyPath, []byte(publicKeyPEM), 0644); err != nil {
		return fmt.Errorf("保存公钥失败: %w", err)
	}

	return nil
}

// LoadKeyPair 从文件加载密钥对
func LoadKeyPair(dir string) (*KeyPairResult, error) {
	privateKeyPath := filepath.Join(dir, "license_private.pem")
	publicKeyPath := filepath.Join(dir, "license_public.pem")

	if _, err := os.Stat(privateKeyPath); os.IsNotExist(err) {
		return nil, errors.New("密钥文件不存在")
	}

	privateKeyData, err := os.ReadFile(privateKeyPath)
	if err != nil {
		return nil, fmt.Errorf("读取私钥文件失败: %w", err)
	}

	publicKeyData, err := os.ReadFile(publicKeyPath)
	if err != nil {
		return nil, fmt.Errorf("读取公钥文件失败: %w", err)
	}

	return &KeyPairResult{
		PrivateKey: string(privateKeyData),
		PublicKey:  string(publicKeyData),
	}, nil
}

// LicenseData 许可证数据
type LicenseData struct {
	LicenseKey          string `json:"license_key"`
	CustomerName        string `json:"customer_name"`
	HardwareFingerprint string `json:"hardware_fingerprint"`
	StartDate           string `json:"start_date"`
	EndDate             string `json:"end_date"`
	CreatedAt           string `json:"created_at"`
}

// LicenseFile 许可证文件结构
type LicenseFile struct {
	Data      string `json:"data"`
	Signature string `json:"signature"`
	Algorithm string `json:"algorithm"`
}

// KeyPairResult 密钥对生成结果
type KeyPairResult struct {
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
}

// App 结构体
type App struct {
	ctx       context.Context
	keysDir   string
	outputDir string
}

// NewApp 创建应用实例
func NewApp() *App {
	return &App{
		keysDir:   "keys",
		outputDir: "output/licenses",
	}
}

// Startup 应用启动
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	os.MkdirAll(a.keysDir, 0700)
	os.MkdirAll(a.outputDir, 0755)
	fmt.Println("CedarLicenseTool v1.0.0 启动中...")
}

// GenerateKeyPair 生成RSA密钥对
func (a *App) GenerateKeyPair() (*KeyPairResult, error) {
	privateKeyPEM, publicKeyPEM, err := GenerateRSAKeyPairInMemory(2048)
	if err != nil {
		return nil, err
	}

	if err := SaveKeyPair(a.keysDir, privateKeyPEM, publicKeyPEM); err != nil {
		return nil, err
	}

	return &KeyPairResult{
		PrivateKey: privateKeyPEM,
		PublicKey:  publicKeyPEM,
	}, nil
}

// LoadKeys 加载密钥
func (a *App) LoadKeys() (*KeyPairResult, error) {
	keyPair, err := LoadKeyPair(a.keysDir)
	if err != nil {
		return nil, nil
	}
	return keyPair, nil
}

func generateLicenseKey() (string, error) {
	bytes := make([]byte, 12)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	hexStr := strings.ToUpper(hex.EncodeToString(bytes))
	return fmt.Sprintf("LIC-DEVICE-%s", hexStr), nil
}

// GenerateLicense 生成许可证
func (a *App) GenerateLicense(customerName, hardwareFingerprint, startDate, endDate string) (string, error) {
	keyPair, err := LoadKeyPair(a.keysDir)
	if err != nil {
		return "", fmt.Errorf("请先创建密钥对: %w", err)
	}

	privateKey, err := LoadRSAPrivateKeyFromString(keyPair.PrivateKey)
	if err != nil {
		return "", fmt.Errorf("加载私钥失败: %w", err)
	}

	licenseKey, err := generateLicenseKey()
	if err != nil {
		return "", fmt.Errorf("生成许可证密钥失败: %w", err)
	}

	now := time.Now()
	licenseData := LicenseData{
		LicenseKey:          licenseKey,
		CustomerName:        customerName,
		HardwareFingerprint: hardwareFingerprint,
		StartDate:           startDate,
		EndDate:             endDate,
		CreatedAt:           now.Format(time.RFC3339),
	}

	dataJSON, err := json.Marshal(licenseData)
	if err != nil {
		return "", fmt.Errorf("序列化数据失败: %w", err)
	}

	signature, err := privateKey.SignData(dataJSON)
	if err != nil {
		return "", fmt.Errorf("签名失败: %w", err)
	}

	licenseFile := LicenseFile{
		Data:      string(dataJSON),
		Signature: signature,
		Algorithm: "RSA-PSS-SHA256",
	}

	licenseJSON, err := json.Marshal(licenseFile)
	if err != nil {
		return "", fmt.Errorf("序列化许可证文件失败: %w", err)
	}

	return base64.StdEncoding.EncodeToString(licenseJSON), nil
}

// SaveLicense 保存许可证到文件
func (a *App) SaveLicense(licenseContent, filename string) error {
	filePath := filepath.Join(a.outputDir, filename)
	return os.WriteFile(filePath, []byte(licenseContent), 0644)
}

// GetOutputDir 获取输出目录
func (a *App) GetOutputDir() string {
	absPath, _ := filepath.Abs(a.outputDir)
	return absPath
}

// GetKeysDir 获取密钥目录
func (a *App) GetKeysDir() string {
	absPath, _ := filepath.Abs(a.keysDir)
	return absPath
}

// ExportArchive 导出存档
func (a *App) ExportArchive(licenseContent, customerName string) (string, error) {
	tempDir := filepath.Join(os.TempDir(), "cedar-license-export", fmt.Sprintf("license_%s", customerName))
	os.MkdirAll(tempDir, 0700)

	licenseFile := filepath.Join(tempDir, fmt.Sprintf("license_%s.lic", customerName))
	if err := os.WriteFile(licenseFile, []byte(licenseContent), 0644); err != nil {
		return "", fmt.Errorf("保存许可证文件失败: %w", err)
	}

	keyPair, err := LoadKeyPair(a.keysDir)
	if err != nil {
		return "", fmt.Errorf("加载密钥失败: %w", err)
	}
	publicKeyFile := filepath.Join(tempDir, "license_public.pem")
	if err := os.WriteFile(publicKeyFile, []byte(keyPair.PublicKey), 0644); err != nil {
		return "", fmt.Errorf("保存公钥文件失败: %w", err)
	}

	return tempDir, nil
}

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "CedarLicenseTool - 许可证分发工具",
		Width:            1440,
		Height:           900,
		BackgroundColour: &options.RGBA{R: 234, G: 246, B: 255, A: 255},
		MinWidth:         900,
		MinHeight:        700,
		Assets:           assets,
		OnStartup:        app.Startup,
		Bind:             []interface{}{app},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "应用程序启动失败: %v\n", err)
		os.Exit(1)
	}
}

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ================= 配置区域 =================
const APKTOOL_PATH = path.join(__dirname, 'apktool_3.0.2.jar'); // 请确保根目录有 apktool_3.0.2.jar
const UBER_SIGNER_PATH = path.join(__dirname, 'uber-apk-signer.jar'); // 我们刚下载的签名工具
const KEYSTORE_PATH = path.join(__dirname, 'my-key.jks'); // 你的签名文件路径
const KEYSTORE_PASS = '123456'; // 签名密码

const BASE_APK = path.join(__dirname, 'base.apk'); // 手机上打出的空壳/任意APK
const PROJECT_DIR = path.join(__dirname, '..'); // 项目源码根目录
const TEMP_DIR = path.join(__dirname, 'build_temp');
const OUTPUT_UNSIGNED_APK = path.join(__dirname, 'unsigned.apk');
const JAVA_PATH = 'C:\\Program Files\\Java\\jre1.8.0_491\\bin\\java.exe'; // 使用你机器上的绝对路径
// ==========================================

console.log("🚀 开始本地打包流程...");

// 1. 解析 project.json
const projectJsonPath = path.join(PROJECT_DIR, 'project.json');
if (!fs.existsSync(projectJsonPath)) {
    console.error("❌ 找不到 project.json");
    process.exit(1);
}
const projectInfo = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
console.log(`📦 项目信息: ${projectInfo.name} (${projectInfo.packageName})`);

// 2. 使用 Python 无损重组 APK，完美兼容 Android 严格的 Zip 校验
console.log("🔨 正在使用 Python 无损重建 APK (彻底解决 -18 安装错误)...");
if (!fs.existsSync(BASE_APK)) {
    console.error(`❌ 找不到基础包: ${BASE_APK}。请从手机打包一个传到该目录下！`);
    process.exit(1);
}

console.log("📂 正在注入源代码...");
const pyScriptPath = path.join(__dirname, 'inject.py');
const pyScript = `
import zipfile
import os
import sys

base_apk = sys.argv[1]
output_apk = sys.argv[2]
project_dir = sys.argv[3]
new_manifest = sys.argv[4] if len(sys.argv) > 4 else None

include_list = ['main.js', 'config.js', 'project.json', 'src', 'templates', 'res']
items_to_add = []

for inc in include_list:
    path = os.path.join(project_dir, inc)
    if os.path.isfile(path):
        items_to_add.append(path)
    elif os.path.isdir(path):
        for root, dirs, files in os.walk(path):
            for file in files:
                items_to_add.append(os.path.join(root, file))

with zipfile.ZipFile(base_apk, 'r') as zin:
    with zipfile.ZipFile(output_apk, 'w') as zout:
        for item in zin.infolist():
            # Skip old project files
            if item.filename.startswith('assets/project/'):
                continue
            # Skip old manifest if we are replacing it
            if new_manifest and item.filename == 'AndroidManifest.xml':
                continue
                
            # 保持原有的压缩方式和属性
            buffer = zin.read(item.filename)
            zout.writestr(item, buffer)
        
        # 注入新的 AndroidManifest.xml
        if new_manifest and os.path.isfile(new_manifest):
            zout.write(new_manifest, 'AndroidManifest.xml', compress_type=zipfile.ZIP_DEFLATED)

        # 注入新文件，统一使用 DEFLATED 压缩
        for item_path in items_to_add:
            rel_path = os.path.relpath(item_path, project_dir)
            arcname = 'assets/project/' + rel_path.replace('\\\\', '/')
            zout.write(item_path, arcname, compress_type=zipfile.ZIP_DEFLATED)
`;
fs.writeFileSync(pyScriptPath, pyScript);

// 执行 Python 注入
if (fs.existsSync(OUTPUT_UNSIGNED_APK)) {
    fs.rmSync(OUTPUT_UNSIGNED_APK, { force: true });
}
execSync(`python "${pyScriptPath}" "${BASE_APK}" "${OUTPUT_UNSIGNED_APK}" "${PROJECT_DIR}"`, { stdio: 'inherit' });
fs.rmSync(pyScriptPath);

console.log("📦 注入完毕，准备签名...");

// 7. 签名
console.log("🔐 正在使用 uber-apk-signer 签名 APK...");
if (!fs.existsSync(KEYSTORE_PATH)) {
    console.error(`❌ 找不到签名文件: ${KEYSTORE_PATH}。请先生成一个 JKS 证书！`);
    process.exit(1);
}
// 使用 uber-apk-signer 完成自动对齐和签名
execSync(`"${JAVA_PATH}" -jar "${UBER_SIGNER_PATH}" -a "${OUTPUT_UNSIGNED_APK}" --ks "${KEYSTORE_PATH}" --ksAlias my-alias --ksPass ${KEYSTORE_PASS} --ksKeyPass ${KEYSTORE_PASS}`, { stdio: 'inherit' });

// 清理产物
const signedApkPath = path.join(__dirname, 'unsigned-aligned-signed.apk');
if (fs.existsSync(signedApkPath)) {
    const finalPath = path.join(__dirname, '../Auto-rocokingdom-release.apk');
    fs.copyFileSync(signedApkPath, finalPath);
    console.log(`✅ 打包成功！最终 APK 已生成在: ${finalPath}`);
} else {
    console.error("❌ 签名过程未生成预期的文件。");
}

const config = require("./config.js");

console.show();
console.log("=== SIFT 本地匹配诊断工具 ===");

let targetPath = files.cwd() + "/debug_capture_first.png";
let targetImg = images.read(targetPath);
if (!targetImg) {
    console.error("未找到保存的目标大图！请先让主脚本跑取一次以保存 debug_capture_first.png");
    exit();
}

// 找一个模板进行比对，假设用 combat_indicator 或者 templates 下随便一个
let templatePath = null;
let dir = files.cwd() + "/" + config.TEMPLATE_DIR;
let list = files.listDir(dir);
for (let item of list) {
    if (item.endsWith(".png") || item.endsWith(".jpg")) {
        templatePath = dir + item;
        break;
    }
}

if (!templatePath) {
    console.error("在 templates 目录未找到任何图片，请放入至少一个测试模板！");
    targetImg.recycle();
    exit();
}

console.log(`载入测试目标大图: ${targetImg.width} x ${targetImg.height}`);
let tplImg = images.read(templatePath);
console.log(`载入测试模板小图: ${templatePath} (${tplImg.width} x ${tplImg.height})`);

// 测试 1: 直接传入彩色图
try {
    let tplFeats = images.detectAndComputeFeatures(tplImg, { method: "SIFT" });
    let sceneFeats = images.detectAndComputeFeatures(targetImg, { method: "SIFT" });
    console.log("[彩色提取] 模板特征数:", tplFeats ? "存在" : "空", typeof tplFeats);
    console.log("[彩色提取] 场景特征数:", sceneFeats ? "存在" : "空", typeof sceneFeats);

    // 尝试不同的匹配模式
    let res1 = images.matchFeatures(sceneFeats, tplFeats, { threshold: 0.8, matcher: "FLANNBASED" });
    console.log("----> (Scene, Tpl) FLANNBASED 匹配数:", (res1 && res1.matches) ? res1.matches.length : 0);

    let res2 = images.matchFeatures(sceneFeats, tplFeats, { threshold: 0.8, matcher: "BRUTEFORCE" });
    console.log("----> (Scene, Tpl) BRUTEFORCE 匹配数:", (res2 && res2.matches) ? res2.matches.length : 0);

    let res3 = images.matchFeatures(tplFeats, sceneFeats, { threshold: 0.8, matcher: "BRUTEFORCE" });
    console.log("----> 反接 (Tpl, Scene) BRUTEFORCE 匹配数:", (res3 && res3.matches) ? res3.matches.length : 0);

    tplFeats.recycle();
    sceneFeats.recycle();
} catch (e) {
    console.error("彩色提取/匹配报错: " + e);
}

// 测试 2: 转为灰度后再提取
try {
    console.log("\n--- 将图片转为灰度继续测试 ---");
    let grayTarget = images.grayscale(targetImg);
    let grayTpl = images.grayscale(tplImg);

    let tplFeats = images.detectAndComputeFeatures(grayTpl, { method: "SIFT" });
    let sceneFeats = images.detectAndComputeFeatures(grayTarget, { method: "SIFT" });
    console.log("[灰度提取] 特征对象是否成功:", tplFeats && sceneFeats ? "成功" : "失败");
    
    let res = images.matchFeatures(sceneFeats, tplFeats, { threshold: 0.8, matcher: "FLANNBASED" });
    console.log("----> 灰度匹配结果:", (res && res.matches) ? res.matches.length : 0);

    grayTarget.recycle();
    grayTpl.recycle();
    tplFeats.recycle();
    sceneFeats.recycle();
} catch (e) {
    console.error("灰度测试报错: " + e);
}

targetImg.recycle();
tplImg.recycle();
console.log("======= 测试完毕 =======");

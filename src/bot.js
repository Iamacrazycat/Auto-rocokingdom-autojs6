var config = require("../config.js");
const vision = require("./vision.js");
const inputHandler = require("./input.js");

function AutoRocoBot(mode) {
    // mode: "1" (聚能), "2" (逃跑), "3" (智能)
    this.mode = mode;
    this.templates = {};
    this.inBattleState = false;
    this.hitStreak = 0;
    this.missStreak = 0;
    this.lastTriggerTime = 0;
    this.firstCaptureDone = false;
}

AutoRocoBot.prototype.init = function() {
    console.log("正在加载特征模板并初始化 Bot...");
    if (!requestScreenCapture(true)) {
        toastLog("请求截图失败，停止运行");
        exit();
    }
    this.templates = vision.loadTemplates();
    console.log("模板加载完成！当前运行模式:", this.mode);
    sleep(1000);
};

// 工具方法：遍历匹配包含变体的多个模板名
AutoRocoBot.prototype.findAnyTemplate = function(screenImg, baseNames, customThreshold) {
    for (let i = 0; i < baseNames.length; i++) {
        let tplName = baseNames[i];
        let tpl = this.templates[tplName];
        if (tpl) {
            let match = vision.matchFeature(screenImg, tpl, customThreshold);
            if (match) {
                console.verbose("[匹配溯源] 模板 [" + tplName + "] 判定成功");
                return match;
            }
        }
    }
    return null;
};

AutoRocoBot.prototype.run = function() {
    console.log("-> 启动监控循环...");
    while (true) {
        let screenImg = captureScreen();
        if (!screenImg) {
            console.warn("未能获取屏幕截图...");
            sleep(config.POLL_INTERVAL_MS);
            continue;
        }

        // 调试：保存首张截图
        if (!this.firstCaptureDone) {
            console.log("[调试] 观察到首张截图尺寸: " + screenImg.width + " x " + screenImg.height);
            let debugPath = files.cwd() + "/debug_capture_first.png";
            images.save(screenImg, debugPath);
            console.log("[调试] 已将本次运行的首张截图保存到本地文件夹：" + debugPath);
            console.log("[非常重要] 请立刻去文件夹里打开这张图验证！它可能是全黑的（游戏有防截屏保护），也可能是竖屏严重变形的！这是导致SIFT找图失败的关键！");
            this.firstCaptureDone = true;
        }

        // 1. 使用 OCR 判断战斗环境
        let ocrResults = vision.detectOcrText(screenImg);
        let combatKeywords = ["更换", "逃跑", "技能", "捕捉", "背包", "聚能"];
        let matchedKeywords = 0;
        let matchedNames = [];
        let ocrMap = {};

        if (ocrResults && ocrResults.length > 0) {
            let allTexts = ocrResults.map(r => r.text);
            console.verbose("[OCR 原始结果] 共" + ocrResults.length + "条: " + allTexts.join(" | "));

            ocrResults.forEach(res => {
                combatKeywords.forEach(kw => {
                    if (res.text.indexOf(kw) !== -1 && !ocrMap[kw]) {
                        matchedKeywords++;
                        matchedNames.push(kw);
                        ocrMap[kw] = res.bounds;
                    }
                });
            });
            if (matchedKeywords > 0) {
                console.verbose("[OCR 命中] " + matchedNames.join(", ") + " (" + matchedKeywords + "/" + combatKeywords.length + ")");
            }
        } else {
            console.verbose("[OCR] 本轮未识别到任何文字");
        }

        let detected = (matchedKeywords >= 2);

        if (detected) {
            this.hitStreak++;
            this.missStreak = 0;
        } else {
            this.hitStreak = 0;
            this.missStreak++;
        }

        // 状态机平滑逻辑
        if (!this.inBattleState) {
            this.inBattleState = (this.hitStreak >= config.REQUIRED_HITS);
        } else {
            if (this.missStreak >= config.RELEASE_MISSES) {
                this.inBattleState = false;
            }
        }

        // 2. 如果在战斗状态中且冷却完毕，进行智能判定和动作输出
        let now = new Date().getTime();
        if (this.inBattleState && (now - this.lastTriggerTime >= config.TRIGGER_COOLDOWN_MS)) {
            this.decideAndAct(screenImg, ocrMap);
            this.lastTriggerTime = now;
        } else {
            console.verbose("[监控轮询] 战斗状态: " + this.inBattleState + " | OCR命中字数: " + matchedKeywords + " | 连续识别成功: " + this.hitStreak + " | 连续丢失: " + this.missStreak);
        }

        if (screenImg) {
            screenImg.recycle();
        }

        sleep(config.POLL_INTERVAL_MS);
    }
};

AutoRocoBot.prototype.decideAndAct = function(screenImg, ocrMap) {
    let currentAction = this.mode;
    
    if (this.mode === "3") {
        let purpleRatio = vision.detectPurpleRatio(screenImg);
        console.log("[Smart] 紫底比例: " + purpleRatio.toFixed(4) + " (阈值: " + config.SMART_MODE_PURPLE_RATIO_THRESHOLD + ")");
        
        if (purpleRatio >= config.SMART_MODE_PURPLE_RATIO_THRESHOLD) {
            console.log("-> 紫底匹配成功：正常挂机 -> 执行[聚能]操作");
            currentAction = "1";
        } else {
            console.log("-> 未匹配到紫底：意外遇敌 -> 执行[逃跑]操作");
            currentAction = "2";
        }
    }

    if (currentAction === "1") {
        let skillBounds = ocrMap["聚能"] || ocrMap["技能"];
        let loc = null;
        
        if (skillBounds) {
            loc = vision.calculateIconClick(screenImg, skillBounds);
        } else {
            loc = this.findAnyTemplate(screenImg, ["skill_x", "skill_x_purple"]);
        }
        
        if (loc) {
            inputHandler.clickSkillX(loc);
        } else {
            console.warn("[聚能] 找不到包含 '聚能/技能' 的文字或变体模板，无法匹配");
        }
    } else if (currentAction === "2") {
        let escapeBounds = ocrMap["逃跑"];
        let escLoc = null;
        
        if (escapeBounds) {
            escLoc = vision.calculateIconClick(screenImg, escapeBounds);
        } else {
            escLoc = this.findAnyTemplate(screenImg, ["escape_btn", "escape_btn_purple"], 0.42);
        }
        
        if (escLoc) {
            inputHandler.clickEscape(escLoc);
            sleep(1000); 
            
            let newScreen = captureScreen();
            let yesLoc = newScreen ? this.findAnyTemplate(newScreen, ["escape_yes", "escape_yes_purple"], 0.42) : null;
            if (yesLoc) {
                inputHandler.clickConfirmYes(yesLoc);
                console.log("[逃跑] 已成功执行逃跑+确认，重置战斗状态，等待画面过渡...");
                this.inBattleState = false;
                this.hitStreak = 0;
                this.missStreak = 0;
            } else {
                console.warn("[逃跑] 未能识别到确认 '是' 按钮，无法点击");
            }
            if (newScreen) newScreen.recycle();
            sleep(3000);
        } else {
            console.warn("[逃跑] OCR 未找到'逃跑'且模板也未匹配，跳过本轮");
        }
    }
};

module.exports = AutoRocoBot;

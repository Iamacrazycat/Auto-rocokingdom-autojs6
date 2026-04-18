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
    this.firstCaptureDone = false; // 用于控制只触发一次调试截图保存
}

AutoRocoBot.prototype.init = function() {
    console.log("正在加载特征模板并初始化 Bot...");
    // AutoJS 需要请求截图权限
    // 由于洛克王国是横屏游戏，必须请求横屏截图权限，否则会导致截图方向错误甚至被裁剪变形！
    if (!requestScreenCapture(true)) {
        toastLog("请求截图失败，停止运行");
        exit();
    }
    this.templates = vision.loadTemplates();
    console.log("模板加载完成！当前运行模式:", this.mode);
    sleep(1000); // 稍微等待，给用户切换回游戏的时间
};

// 工具方法：遍历匹配包含变体的多个模板名
AutoRocoBot.prototype.findAnyTemplate = function(screenImg, baseNames, customThreshold) {
    for (let i = 0; i < baseNames.length; i++) {
        let tplName = baseNames[i];
        let tpl = this.templates[tplName];
        if (tpl) {
            let match = vision.matchFeature(screenImg, tpl, customThreshold);
            if (match) {
                console.verbose(`[匹配溯源] 模板 [${tplName}] 判定成功`);
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

        // ====== 调试代码：保存第一次成功的截图供肉眼排查 ======
        if (!this.firstCaptureDone) {
            console.log(`[调试] 观察到首张截图尺寸: ${screenImg.width} x ${screenImg.height}`);
            let debugPath = files.cwd() + "/debug_capture_first.png";
            images.save(screenImg, debugPath);
            console.log(`[调试] 已将本次运行的首张截图保存到本地文件夹：${debugPath}`);
            console.log(`[非常重要] 请立刻去文件夹里打开这张图验证！它可能是全黑的（游戏有防截屏保护），也可能是竖屏严重变形的！这是导致SIFT找图失败的关键！`);
            this.firstCaptureDone = true;
        }
        // ===============================================

        // 1. 判断是否进入战斗环境 (可以通过找特定的标志物，比如血条或者名字框)
        // 游戏产生紫底时会有全屏染色（Overlay滤镜），使得不透明UI也被染上紫色，从而彻底破坏 RGB/NCC 的匹配矩阵。
        // 因此增加读取 "_purple" 结尾的替代截屏图选项。如果你遇到纯找图失效，请在紫底时截一张按钮保存为 `combat_indicator_purple.png`。
        let indicatorMatch = this.findAnyTemplate(screenImg, ["combat_indicator", "combat_indicator_purple"]);
        let detected = false;

        // 判断 template 里面有没有传入过任意一个 combat 模板，来决定我们是否要有这个校验
        let hasIndicatorTpl = this.templates["combat_indicator"] || this.templates["combat_indicator_purple"];

        if (hasIndicatorTpl) {
            if (indicatorMatch) {
                detected = true;
                this.hitStreak++;
                this.missStreak = 0;
            } else {
                this.hitStreak = 0;
                this.missStreak++;
            }
        } else {
            // 如果没有提供战斗状态指示图，我们可以假设每次轮询都尝试判断（虽然开销较大）
            // 测试阶段或者模板不全时，强制触发
            detected = true; 
        }

        // 状态机平滑逻辑
        if (!this.inBattleState) {
            this.inBattleState = (this.hitStreak >= config.REQUIRED_HITS || !hasIndicatorTpl);
        } else {
            if (this.missStreak >= config.RELEASE_MISSES) {
                this.inBattleState = false;
            }
        }

        // 2. 如果在战斗状态中且冷却完毕，进行智能判定和动作输出
        let now = new Date().getTime();
        if (this.inBattleState && (now - this.lastTriggerTime >= config.TRIGGER_COOLDOWN_MS)) {
            this.decideAndAct(screenImg);
            this.lastTriggerTime = now;
        } else {
            // 每隔一段轮询时间输出一下当前状态，让用户知道脚本不仅没有卡死，而且还在积极监测
            console.verbose(`[监控轮询] 战斗状态: ${this.inBattleState} | 连续识别成功: ${this.hitStreak} | 连续丢失: ${this.missStreak}`);
        }

        // 极其重要：AutoJS 循环截屏会生成极大的 ImageWrapper 对象，必须回收防止手机 OOM 内存溢出
        if (screenImg) {
            screenImg.recycle();
        }

        sleep(config.POLL_INTERVAL_MS);
    }
};

AutoRocoBot.prototype.decideAndAct = function(screenImg) {
    let currentAction = this.mode;
    
    if (this.mode === "3") { // 智能挂机模式
        let purpleRatio = vision.detectPurpleRatio(screenImg);
        console.log(`[Smart] 紫底比例: ${purpleRatio.toFixed(4)} (阈值: ${config.SMART_MODE_PURPLE_RATIO_THRESHOLD})`);
        
        if (purpleRatio >= config.SMART_MODE_PURPLE_RATIO_THRESHOLD) {
            console.log("-> 紫底匹配成功：正常挂机 -> 执行[聚能]操作");
            currentAction = "1";
        } else {
            console.log("-> 未匹配到紫底：意外遇敌 -> 执行[逃跑]操作");
            currentAction = "2";
        }
    }

    if (currentAction === "1") {
        // 聚能模式：寻找技能按钮的特征图（例如 skill_x.png）并点击
        let loc = this.findAnyTemplate(screenImg, ["skill_x", "skill_x_purple"]);
        if (loc) {
            inputHandler.clickSkillX(loc);
        } else {
            console.warn("[聚能] 找不到 skill_x 或变体模板，无法匹配");
            // Fallback click, 或者调用 OCR (如果实现了)
        }
    } else if (currentAction === "2") {
        // 逃跑模式
        // 由于在紫底期间按钮可能会有半透明染色，强行调低单独容差到 0.42，同时也支持逃跑专属变体
        let escLoc = this.findAnyTemplate(screenImg, ["escape_btn", "escape_btn_purple"], 0.42);
        
        if (escLoc) {
            inputHandler.clickEscape(escLoc);
            // 给界面一点反应时间弹窗
            sleep(1000); 
            
            let newScreen = captureScreen();
            let yesLoc = newScreen ? this.findAnyTemplate(newScreen, ["escape_yes", "escape_yes_purple"], 0.42) : null;
            if (yesLoc) {
                inputHandler.clickConfirmYes(yesLoc);
            } else {
                console.warn("[逃跑] 未能识别到确认 '是' 按钮变体特征，无法点击");
            }
            if (newScreen) newScreen.recycle(); // 记得回收！
        } else {
            console.warn("[逃跑] 找不到 escape_btn 或变体模板，无法逃跑");
        }
    }
};

module.exports = AutoRocoBot;

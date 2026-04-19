var AutoRocoBot = require("./src/bot.js");

function main() {
    console.show();
    console.setPosition(100, 100);
    
    console.log("=== Auto-Roco Android特征化脚本重构版启动 ===");
    console.log("正在检查权限...");

    // 确保有无障碍权限，用于执行安全屏幕点击 click()
    auto.waitFor();

    // 弹窗让用户选择模式
    let options = [
        "1: 聚能模式", 
        "2: 逃跑模式", 
        "3: 智能模式"
    ];
    let selectedIndex = dialogs.select("请选择需要运行的模式:", options);

    if (selectedIndex < 0) {
        toastLog("取消选择，运行完毕");
        exit();
    }

    // 模式映射："1"、"2"、"3"
    let modeValue = (selectedIndex + 1).toString();
    
    // 实例化主机器人
    let bot = new AutoRocoBot(modeValue);
    
    // 监听音量减建结束脚本
    threads.start(function() {
        events.observeKey();
        events.onKeyDown("volume_down", function(event) {
            toastLog("收到中断信号：音量下键被按下");
            console.log("退出运行");
            engines.myEngine().forceStop();
        });
    });

    bot.init();
    // 隐藏控制台悬浮窗，防止 OCR 把控制台文字当成游戏 UI 误识别
    console.hide();
    bot.run();
}

// 启动入口
main();

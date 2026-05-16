"ui";

var storage = storages.create("auto_roco_config");
var AutoRocoBot = require("./src/bot.js");

// 尝试解除 Auto.js6 默认的音量下键停止脚本绑定
try {
    $settings.setEnabled('stop_all_on_volume_down', false);
} catch (e) {
    console.error("无法解除音量下键绑定: " + e);
}

ui.layout(
    <scroll>
        <vertical padding="16">
            <text text="Auto-Roco 自动化挂机" textSize="24sp" textColor="#000000" textStyle="bold" gravity="center" margin="0 0 0 16"/>

            <card w="*" h="auto" margin="0 0 0 16" cardElevation="2dp" cardCornerRadius="4dp">
                <vertical padding="16">
                    <text text="权限设置" textSize="18sp" textColor="#333333" textStyle="bold" margin="0 0 0 8"/>
                    <button id="btn_acc" text="开启无障碍服务" style="Widget.AppCompat.Button.Colored"/>
                    <button id="btn_float" text="开启悬浮窗权限" style="Widget.AppCompat.Button.Colored"/>
                </vertical>
            </card>

            <card w="*" h="auto" margin="0 0 0 16" cardElevation="2dp" cardCornerRadius="4dp">
                <vertical padding="16">
                    <text text="参数配置" textSize="18sp" textColor="#333333" textStyle="bold" margin="0 0 0 8"/>
                    
                    <horizontal margin="0 4">
                        <text text="轮询间隔(ms):" w="120" gravity="center_vertical"/>
                        <input id="input_poll" inputType="number" text="3000" w="*"/>
                    </horizontal>
                    
                    <horizontal margin="0 4">
                        <text text="模板匹配阈值:" w="120" gravity="center_vertical"/>
                        <input id="input_threshold" inputType="numberDecimal" text="0.7" w="*"/>
                    </horizontal>

                    <horizontal margin="0 4">
                        <text text="基准屏幕宽度:" w="120" gravity="center_vertical"/>
                        <input id="input_width" inputType="number" text="2772" w="*"/>
                    </horizontal>

                    <horizontal margin="0 4">
                        <text text="基准屏幕高度:" w="120" gravity="center_vertical"/>
                        <input id="input_height" inputType="number" text="1280" w="*"/>
                    </horizontal>
                    
                    <button id="btn_save" text="保存配置" margin="0 8 0 0"/>
                </vertical>
            </card>

            <card w="*" h="auto" margin="0 0 0 16" cardElevation="2dp" cardCornerRadius="4dp">
                <vertical padding="16">
                    <text text="运行控制" textSize="18sp" textColor="#333333" textStyle="bold" margin="0 0 0 8"/>
                    <horizontal margin="0 0 0 8">
                        <text text="选择模式:" gravity="center_vertical" margin="0 0 8 0"/>
                        <spinner id="sp_mode" entries="1: 聚能模式|2: 逃跑模式|3: 智能模式" w="*"/>
                    </horizontal>
                    <button id="btn_start" text="启动脚本" style="Widget.AppCompat.Button.Colored" bg="#4CAF50"/>
                    <button id="btn_stop" text="停止脚本" style="Widget.AppCompat.Button.Colored" bg="#F44336"/>
                </vertical>
            </card>
            
        </vertical>
    </scroll>
);

// 初始化 UI 数据
ui.input_poll.setText(storage.get("POLL_INTERVAL_MS", 3000).toString());
ui.input_threshold.setText(storage.get("TEMPLATE_MATCH_THRESHOLD", 0.7).toString());
ui.input_width.setText(storage.get("REF_WIDTH", 2772).toString());
ui.input_height.setText(storage.get("REF_HEIGHT", 1280).toString());

// 权限引导
ui.btn_acc.click(() => {
    app.startActivity({
        action: "android.settings.ACCESSIBILITY_SETTINGS"
    });
    toastLog("请在设置中开启本应用的无障碍服务");
});

ui.btn_float.click(() => {
    let intent = new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        android.net.Uri.parse("package:" + context.getPackageName()));
    app.startActivity(intent);
    toastLog("请在设置中允许显示在其他应用上层");
});

// 保存配置
ui.btn_save.click(() => {
    storage.put("POLL_INTERVAL_MS", parseInt(ui.input_poll.text()) || 3000);
    storage.put("TEMPLATE_MATCH_THRESHOLD", parseFloat(ui.input_threshold.text()) || 0.7);
    storage.put("REF_WIDTH", parseInt(ui.input_width.text()) || 2772);
    storage.put("REF_HEIGHT", parseInt(ui.input_height.text()) || 1280);
    toastLog("配置已保存");
});

// 运行控制
var botThread = null;

ui.btn_start.click(() => {
    if (botThread && botThread.isAlive()) {
        toastLog("脚本已经在运行中");
        return;
    }

    if (!auto.service) {
        toastLog("请先开启无障碍服务！");
        return;
    }

    if (!android.provider.Settings.canDrawOverlays(context)) {
        toastLog("请先开启悬浮窗权限！");
        return;
    }

    // 确保启动前保存最新配置
    ui.btn_save.performClick();

    let modeIndex = ui.sp_mode.getSelectedItemPosition();
    let modeValue = (modeIndex + 1).toString(); // "1", "2" 或 "3"

    botThread = threads.start(function() {
        // 创建悬浮窗
        var w = floaty.window(
            <frame>
                <vertical bg="#cc000000" padding="8" cornerRadius="8">
                    <text id="drag" text="≡ 拖动 ≡" textColor="#ffffff" gravity="center" textSize="12sp" w="*"/>
                    <button id="btn_toggle" text="暂停" margin="0 4" h="40" textSize="14sp"/>
                    <button id="btn_close" text="关闭" margin="0 4" h="40" textSize="14sp"/>
                </vertical>
            </frame>
        );

        w.setPosition(100, 100);

        // 拖动逻辑
        var wx, wy, tx, ty;
        w.drag.setOnTouchListener(function(view, event) {
            switch (event.getAction()) {
                case event.ACTION_DOWN:
                    wx = event.getRawX();
                    wy = event.getRawY();
                    tx = w.getX();
                    ty = w.getY();
                    return true;
                case event.ACTION_MOVE:
                    w.setPosition(tx + (event.getRawX() - wx), ty + (event.getRawY() - wy));
                    return true;
            }
            return true;
        });

        console.log("=== Auto-Roco 启动 ===");
        
        let bot = new AutoRocoBot(modeValue);

        // 暂停/继续切换
        w.btn_toggle.click(() => {
            bot.isPaused = !bot.isPaused;
            if (bot.isPaused) {
                ui.run(() => w.btn_toggle.setText("继续"));
                toastLog("已暂停挂机，点击继续恢复");
            } else {
                ui.run(() => w.btn_toggle.setText("暂停"));
                toastLog("已恢复挂机");
            }
        });

        // 关闭悬浮窗与脚本
        w.btn_close.click(() => {
            toastLog("脚本已从悬浮窗关闭");
            w.close();
            botThread.interrupt();
            botThread = null;
        });

        bot.init();
        bot.run();
    });
    toastLog("脚本已启动");
});

ui.btn_stop.click(() => {
    if (botThread && botThread.isAlive()) {
        botThread.interrupt();
        botThread = null;
        toastLog("脚本已停止");
    } else {
        toastLog("脚本未运行");
    }
});

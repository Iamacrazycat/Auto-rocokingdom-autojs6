var FloatyManager = {};

FloatyManager.init = function(bot, botThread) {
    // 创建悬浮窗
    var w = floaty.window(
        <frame w="auto" h="auto">
            {/* 展开的菜单 */}
            <horizontal id="menu" bg="#aa000000" padding="8" cornerRadius="22" visibility="gone" gravity="center_vertical">
                <img id="btn_collapse" w="28" h="28" src="@drawable/ic_chevron_left_black_48dp" tint="#ffffff" margin="0 0 8 0"/>
                <text id="btn_toggle" text="暂停" textColor="#ffffff" textSize="14sp" margin="0 0 8 0" bg="#55ffffff" padding="6 12" cornerRadius="12"/>
                <text id="btn_close" text="关闭" textColor="#ffffff" textSize="14sp" bg="#ff4c4c" padding="6 12" cornerRadius="12"/>
            </horizontal>
            {/* 悬浮球 */}
            <card id="ball" w="44" h="44" cardCornerRadius="22" cardBackgroundColor="#aa4CAF50" cardElevation="0dp" gravity="center">
                <img id="ball_icon" src="@drawable/ic_play_arrow_black_48dp" w="24" h="24" tint="#ffffff" layout_gravity="center"/>
            </card>
        </frame>
    );

    w.setPosition(0, device.height / 3);

    // 拖动逻辑
    var wx, wy, tx, ty;
    var isMoved = false;

    var touchListener = function(view, event) {
        switch (event.getAction()) {
            case event.ACTION_DOWN:
                wx = event.getRawX();
                wy = event.getRawY();
                tx = w.getX();
                ty = w.getY();
                isMoved = false;
                return true;
            case event.ACTION_MOVE:
                if (Math.abs(event.getRawX() - wx) > 10 || Math.abs(event.getRawY() - wy) > 10) {
                    isMoved = true;
                    w.setPosition(tx + (event.getRawX() - wx), ty + (event.getRawY() - wy));
                }
                return true;
            case event.ACTION_UP:
                if (!isMoved && view.getId() == w.ball.getId()) {
                    // 点击悬浮球，展开菜单
                    ui.run(() => {
                        w.ball.setVisibility(8);
                        w.menu.setVisibility(0);
                    });
                } else if (isMoved) {
                    // 拖动结束，贴边
                    if (w.getX() < device.width / 2) {
                        w.setPosition(0, w.getY());
                    } else {
                        w.setPosition(device.width, w.getY());
                    }
                }
                return true;
        }
        return true;
    };

    w.ball.setOnTouchListener(touchListener);
    w.menu.setOnTouchListener(touchListener);

    w.btn_collapse.click(() => {
        ui.run(() => {
            w.menu.setVisibility(8);
            w.ball.setVisibility(0);
        });
    });

    // 暂停/继续切换
    w.btn_toggle.click(() => {
        bot.isPaused = !bot.isPaused;
        if (bot.isPaused) {
            ui.run(() => {
                w.btn_toggle.setText("继续");
                w.ball.setCardBackgroundColor(colors.parseColor("#aaFF9800"));
                w.ball_icon.attr("src", "@drawable/ic_pause_black_48dp");
            });
            toastLog("已暂停挂机");
        } else {
            ui.run(() => {
                w.btn_toggle.setText("暂停");
                w.ball.setCardBackgroundColor(colors.parseColor("#aa4CAF50"));
                w.ball_icon.attr("src", "@drawable/ic_play_arrow_black_48dp");
            });
            toastLog("已恢复挂机");
        }
        w.btn_collapse.performClick();
    });

    // 关闭悬浮窗与脚本
    w.btn_close.click(() => {
        toastLog("脚本及屏幕监听已关闭");
        w.close();
        if (botThread) {
            botThread.interrupt();
        }
        // 彻底退出脚本进程释放录屏权限
        exit();
    });

    return w;
};

module.exports = FloatyManager;

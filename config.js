module.exports = {
    // 轮询间隔，单位毫秒
    POLL_INTERVAL_MS: 3000,

    // 按键冷却时间，单位毫秒
    TRIGGER_COOLDOWN_MS: 1000,

    // 智能模式：紫底 HSV 范围 (H: 0-180, S: 0-255, V: 0-255)
    PURPLE_LOWER_HSV: [125, 40, 40],
    PURPLE_UPPER_HSV: [160, 255, 255],
    SMART_MODE_PURPLE_RATIO_THRESHOLD: 0.05,

    // OCR 战斗判定：至少命中几个关键词
    OCR_COMBAT_THRESHOLD: 2,

    // 状态机连击要求
    REQUIRED_HITS: 1,
    RELEASE_MISSES: 2,

    // escape_yes 模板匹配阈值
    ESCAPE_YES_THRESHOLD: 0.42,

    // 模板图片存放路径
    TEMPLATE_DIR: "templates/",

    // 参考分辨率（用于模板缩放）
    REF_WIDTH: 2560,
    REF_HEIGHT: 1440,
};

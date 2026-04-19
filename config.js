module.exports = {
    // 匹配阈值
    MATCH_THRESHOLD: 0.50,
    
    // 轮询间隔，单位毫秒 (根据性能可调整)
    POLL_INTERVAL_MS: 3000,
    
    // 按键冷却/点击等待时间，单位毫秒
    TRIGGER_COOLDOWN_MS: 1000,
    
    // 智能模式：紫底 HSV 范围 (H: 0-180, S: 0-255, V: 0-255)
    PURPLE_LOWER_HSV: [125, 40, 40],
    PURPLE_UPPER_HSV: [160, 255, 255],
    SMART_MODE_PURPLE_RATIO_THRESHOLD: 0.05,
    
    // 状态判定连击要求
    REQUIRED_HITS: 1,
    RELEASE_MISSES: 2,
    
    // 模板图片存放路径
    TEMPLATE_DIR: "templates/",
    
    // 参考分辨率宽度
    REF_WIDTH: 2560,
};

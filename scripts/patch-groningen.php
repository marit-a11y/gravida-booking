<?php
/**
 * Patch Groningen page (ID 7823):
 * - Remove text-editor widget 6f92f14e (contains old Zuid-Holland text + Bookly shortcode)
 * - Insert HTML iframe widget gravida02 after heading 1d17322 inside container 6be1fcdc
 */

$wpLoad = dirname(__FILE__);
// Walk up to find wp-load.php
for ($i = 0; $i < 8; $i++) {
    if (file_exists($wpLoad . '/wp-load.php')) break;
    $wpLoad = dirname($wpLoad);
}
require $wpLoad . '/wp-load.php';

$PAGE_ID = 7823;

$raw = get_post_meta($PAGE_ID, '_elementor_data', true);
if (!$raw) { die('No elementor data found'); }

$data = json_decode($raw, true);
if (!$data) { die('JSON decode failed: ' . json_last_error_msg()); }

// The new iframe HTML widget to insert
$iframeWidget = [
    'id'         => 'gravida02',
    'elType'     => 'widget',
    'settings'   => [
        'html' => '<div style="width:100%;overflow:hidden;">' .
                  '<iframe id="gravida-booking-iframe-gfd" src="https://gravida-booking.vercel.app/boek/groningen-friesland-drenthe" style="width:100%;height:600px;border:none;display:block;transition:height .15s ease;" scrolling="no" loading="lazy"></iframe>' .
                  '</div>' .
                  '<script>window.addEventListener("message",function(e){var f=document.getElementById("gravida-booking-iframe-gfd");if(f&&e.data&&e.data.type==="gravida-resize"&&e.data.height){f.style.height=(e.data.height+32)+"px";}});</script>',
    ],
    'elements'   => [],
    'widgetType' => 'html',
];

$patched = false;

function patchContainer(&$elements, $containerId, $removeId, $newWidget, &$patched) {
    foreach ($elements as &$el) {
        if (isset($el['id']) && $el['id'] === $containerId && isset($el['elements'])) {
            // Remove the text-editor widget
            $el['elements'] = array_values(array_filter($el['elements'], function($child) use ($removeId) {
                return $child['id'] !== $removeId;
            }));
            // Append the iframe widget at the end
            $el['elements'][] = $newWidget;
            $patched = true;
            return;
        }
        if (!empty($el['elements'])) {
            patchContainer($el['elements'], $containerId, $removeId, $newWidget, $patched);
        }
    }
    unset($el);
}

patchContainer($data, '6be1fcdc', '6f92f14e', $iframeWidget, $patched);

if (!$patched) {
    die('Container 6be1fcdc not found — dumping structure IDs:' . "\n" . implode("\n", array_map(function($el){ return $el['id'] ?? '?'; }, $data)));
}

$newJson = wp_slash(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
update_post_meta($PAGE_ID, '_elementor_data', $newJson);

// Clear Elementor cache
if (class_exists('\Elementor\Plugin')) {
    \Elementor\Plugin::$instance->files_manager->clear_cache();
}

// Clear WP Super Cache / W3TC / LiteSpeed if present
if (function_exists('wp_cache_clear_cache')) wp_cache_clear_cache();
if (function_exists('w3tc_flush_all'))       w3tc_flush_all();
if (function_exists('rocket_clean_domain'))  rocket_clean_domain();
if (class_exists('LiteSpeed\Purge'))         \LiteSpeed\Purge::purge_all();

echo "OK: Groningen page patched successfully. Iframe widget gravida02 inserted.\n";
echo "Removed text-editor: 6f92f14e\n";
echo "Added widget: gravida02\n";

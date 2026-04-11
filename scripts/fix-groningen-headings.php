<?php
/**
 * Fix headings on Groningen page (ID 7823):
 * - Update H1 widget 4b3176e2: "...in Zuid-Holland" → "...in Groningen, Friesland en Drenthe"
 * - Update heading widget 1d17322: "Wij scannen in Zuid-Holland" → "Wij scannen in Groningen, Friesland en Drenthe"
 * - Update text-editor d1a944e: remove Zuid-Holland reference
 * - Update cities section 3a3158ca heading + list for Groningen
 */

$wpLoad = dirname(__FILE__);
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

$fixes = [];

function fixWidgets(&$elements, &$fixes) {
    foreach ($elements as &$el) {
        if (isset($el['id'])) {
            // H1 heading "3D zwangerschapsscan aan huis in Zuid-Holland"
            if ($el['id'] === '4b3176e2' && isset($el['settings']['title'])) {
                $el['settings']['title'] = '3D zwangerschapsscan aan huis in Groningen, Friesland en Drenthe';
                $fixes[] = 'H1 widget 4b3176e2 updated';
            }
            // Sub-heading "Wij scannen in Zuid-Holland"
            if ($el['id'] === '1d17322' && isset($el['settings']['title'])) {
                $old = $el['settings']['title'];
                $el['settings']['title'] = str_replace(
                    ['in Zuid-Holland', 'in Noord-Brabant', 'in Limburg'],
                    'in Groningen, Friesland en Drenthe',
                    $old
                );
                // Also replace any raw HTML mention
                $el['settings']['title'] = preg_replace(
                    '/Wij scannen in .+?(<\/|$)/u',
                    'Wij scannen in Groningen, Friesland en Drenthe$1',
                    $el['settings']['title']
                );
                $fixes[] = 'Heading 1d17322 updated';
            }
            // Intro text editor d1a944e — replace Zuid-Holland mention
            if ($el['id'] === 'd1a944e' && isset($el['settings']['editor'])) {
                $el['settings']['editor'] = str_replace(
                    'Zuid-Holland',
                    'Groningen, Friesland en Drenthe',
                    $el['settings']['editor']
                );
                $fixes[] = 'Text editor d1a944e updated';
            }
            // Cities section heading b28e105 — update city list heading
            if ($el['id'] === '1e76a446' && isset($el['settings']['editor'])) {
                $el['settings']['editor'] = '<p style="text-align: center;">Groningen<br />Leeuwarden<br />Assen<br />Emmen<br />Drachten</p>';
                $fixes[] = 'Cities text-editor 1e76a446 updated for Groningen';
            }
        }
        if (!empty($el['elements'])) {
            fixWidgets($el['elements'], $fixes);
        }
    }
    unset($el);
}

fixWidgets($data, $fixes);

if (empty($fixes)) {
    die('No widgets found to fix. Check widget IDs.');
}

$newJson = wp_slash(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
update_post_meta($PAGE_ID, '_elementor_data', $newJson);

// Clear caches
if (class_exists('\Elementor\Plugin')) {
    \Elementor\Plugin::$instance->files_manager->clear_cache();
}
if (function_exists('wp_cache_clear_cache')) wp_cache_clear_cache();
if (function_exists('rocket_clean_domain'))  rocket_clean_domain();
if (class_exists('LiteSpeed\Purge'))         \LiteSpeed\Purge::purge_all();

echo "OK: Headings fixed on Groningen page.\n";
foreach ($fixes as $f) echo "  - $f\n";

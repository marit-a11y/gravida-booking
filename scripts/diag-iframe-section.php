<?php
require_once dirname(__FILE__) . '/wp-load.php';

$post_id = 1052;
$data = get_post_meta($post_id, '_elementor_data', true);
$decoded = json_decode($data, true);

// Find sections/containers that wrap the iframe, print their margin/padding settings
function find_iframe_parent($elements, $depth = 0, $path = '') {
  foreach ($elements as $el) {
    $id = isset($el['id']) ? $el['id'] : '?';
    $et = isset($el['elType']) ? $el['elType'] : '-';
    $wt = isset($el['widgetType']) ? $el['widgetType'] : '';
    $current_path = $path . " > [$id:$et]";

    // Check if this element IS the iframe widget
    if ($wt === 'html') {
      $html = isset($el['settings']['html']) ? $el['settings']['html'] : '';
      if (strpos($html, 'gravida-booking') !== false) {
        echo "IFRAME WIDGET gevonden: $current_path\n";
        return true;
      }
    }

    if (!empty($el['elements'])) {
      $found = find_iframe_parent($el['elements'], $depth + 1, $current_path);
      if ($found) {
        // Print margin/padding of this parent
        $s = isset($el['settings']) ? $el['settings'] : [];
        echo "  Parent [$id:$et] margin=" . json_encode($s['margin'] ?? 'niet ingesteld') . "\n";
        echo "  Parent [$id:$et] padding=" . json_encode($s['padding'] ?? 'niet ingesteld') . "\n";
        echo "  Parent [$id:$et] _margin=" . json_encode($s['_margin'] ?? 'niet ingesteld') . "\n";
        echo "  Parent [$id:$et] position=" . json_encode($s['position'] ?? 'niet ingesteld') . "\n";
        return true;
      }
    }
  }
  return false;
}

echo "<pre>\n";
find_iframe_parent($decoded);
echo "</pre>";

@unlink(__FILE__);

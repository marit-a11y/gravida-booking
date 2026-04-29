<?php
require_once dirname(__FILE__) . '/wp-load.php';
$post_id = 1052;
$data = get_post_meta($post_id, '_elementor_data', true);
$decoded = json_decode($data, true);

function find_el($elements, $target_id) {
  foreach ($elements as $el) {
    if (($el['id'] ?? '') === $target_id) return $el;
    if (!empty($el['elements'])) {
      $r = find_el($el['elements'], $target_id);
      if ($r) return $r;
    }
  }
  return null;
}

$el = find_el($decoded, 'e594ddc5');
echo "<pre>";
if ($el) {
  $s = $el['settings'];
  unset($s['__globals__']);
  echo json_encode($s, JSON_PRETTY_PRINT);
} else {
  echo "Niet gevonden";
}
echo "</pre>";
@unlink(__FILE__);

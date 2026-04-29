<?php
require_once dirname(__FILE__) . '/wp-load.php';

$post_id = 1052;
$data = get_post_meta($post_id, '_elementor_data', true);
$decoded = json_decode($data, true);

// Print full settings of section f651997f (hero)
foreach ($decoded as $el) {
  if ($el['id'] === 'f651997f') {
    echo "<pre>";
    // Print settings minus sub-elements for clarity
    $s = $el['settings'];
    echo "HERO SECTION SETTINGS:\n";
    echo json_encode($s, JSON_PRETTY_PRINT);
    echo "</pre>";
  }
}
@unlink(__FILE__);

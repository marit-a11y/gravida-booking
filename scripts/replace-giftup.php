<?php
/**
 * replace-giftup.php
 * Replaces GiftUp shortcode/html widgets on cadeau subpages
 * with an iframe embed of the new gift card system.
 * Self-deletes after running.
 */

require_once dirname(__FILE__) . '/wp-load.php';

$BOOKING_URL = 'https://gravida-booking.vercel.app';

// Page ID => type parameter
$pages = [
  1052 => 'digitaal',
  1053 => 'gedrukt',
  1051 => 'usb_box',
];

// Walk Elementor element tree and replace GiftUp widget
function rgc_replace_giftup(&$elements, $iframe_html, &$replaced) {
  foreach ($elements as &$el) {
    $widgetType = isset($el['widgetType']) ? $el['widgetType'] : '';

    // Shortcode widget containing giftup
    if ($widgetType === 'shortcode') {
      $sc = isset($el['settings']['shortcode']) ? $el['settings']['shortcode'] : '';
      if (stripos($sc, 'giftup') !== false) {
        $el['widgetType'] = 'html';
        $el['settings'] = ['html' => $iframe_html];
        $replaced = true;
        continue;
      }
    }

    // HTML widget containing giftup script/shortcode
    if ($widgetType === 'html') {
      $html = isset($el['settings']['html']) ? $el['settings']['html'] : '';
      if (stripos($html, 'giftup') !== false) {
        $el['settings']['html'] = $iframe_html;
        $replaced = true;
        continue;
      }
    }

    // Recurse into children
    if (!empty($el['elements'])) {
      rgc_replace_giftup($el['elements'], $iframe_html, $replaced);
    }
  }
}

$results = [];

foreach ($pages as $post_id => $type) {
  $post = get_post($post_id);
  if (!$post) {
    $results[] = "Page $post_id: NOT FOUND";
    continue;
  }

  $data = get_post_meta($post_id, '_elementor_data', true);
  if (!$data) {
    $results[] = "Page $post_id: geen Elementor data";
    continue;
  }

  $decoded = json_decode($data, true);
  if (!is_array($decoded)) {
    $results[] = "Page $post_id: JSON decode mislukt";
    continue;
  }

  $iframe_html = '<iframe src="' . $BOOKING_URL . '/cadeaubon?type=' . $type . '&embed=1" '
    . 'width="100%" height="780" frameborder="0" '
    . 'style="border:none;border-radius:12px;display:block;" '
    . 'allow="payment" loading="lazy"></iframe>';

  $replaced = false;
  rgc_replace_giftup($decoded, $iframe_html, $replaced);

  if (!$replaced) {
    $results[] = "Page $post_id ($type): geen GiftUp widget gevonden";
    continue;
  }

  $new_data = wp_slash(json_encode($decoded));
  update_post_meta($post_id, '_elementor_data', $new_data);

  // Clear Elementor cache
  if (class_exists('\Elementor\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
    \Elementor\Plugin::$instance->files_manager->clear_cache();
  }

  $results[] = "Page $post_id ($type): vervangen door iframe OK";
}

// Self-delete
@unlink(__FILE__);

echo "<pre>\n";
foreach ($results as $r) {
  echo htmlspecialchars($r) . "\n";
}
echo "</pre>\n<p>Klaar.</p>\n";

<?php
require_once 'wp-load.php';
global $wpdb;
$prefix = 'xKZWW_';

// Find Laila in staff table
$staff = $wpdb->get_results("SELECT * FROM {$prefix}bookly_staff ORDER BY id");
echo "=== STAFF ===\n";
foreach ($staff as $s) {
    echo "ID: {$s->id} | Name: {$s->full_name} | Email: {$s->email}\n";
}

// Check which absence/days-off tables exist
$tables = $wpdb->get_col("SHOW TABLES LIKE '{$prefix}bookly%'");
echo "\n=== BOOKLY TABLES ===\n";
foreach ($tables as $t) echo "$t\n";

// Check staff_days_off if exists
if (in_array("{$prefix}bookly_staff_days_off", $tables)) {
    $rows = $wpdb->get_results("SELECT * FROM {$prefix}bookly_staff_days_off ORDER BY date DESC LIMIT 50");
    echo "\n=== STAFF_DAYS_OFF ===\n";
    foreach ($rows as $r) {
        echo json_encode($r) . "\n";
    }
}

// Check staff special days
if (in_array("{$prefix}bookly_staff_special_days", $tables)) {
    $rows = $wpdb->get_results("SELECT * FROM {$prefix}bookly_staff_special_days ORDER BY start_date DESC LIMIT 50");
    echo "\n=== STAFF_SPECIAL_DAYS ===\n";
    foreach ($rows as $r) {
        echo json_encode($r) . "\n";
    }
}

// Check Google calendar blocked
if (in_array("{$prefix}bookly_google_calendars", $tables)) {
    $rows = $wpdb->get_results("SELECT * FROM {$prefix}bookly_google_calendars LIMIT 10");
    echo "\n=== GOOGLE_CALENDARS ===\n";
    foreach ($rows as $r) echo json_encode($r) . "\n";
}

// Check for any appointments with type=blocked/off
$blocked = $wpdb->get_results("SELECT a.*, s.full_name FROM {$prefix}bookly_appointments a LEFT JOIN {$prefix}bookly_staff s ON s.id = a.staff_id WHERE a.service_id IS NULL OR a.service_id = 0 LIMIT 20");
if ($blocked) {
    echo "\n=== BLOCKED APPOINTMENTS ===\n";
    foreach ($blocked as $r) echo json_encode($r) . "\n";
}

// Check services list to identify "blocked" services
$services = $wpdb->get_results("SELECT id, title, duration FROM {$prefix}bookly_services LIMIT 30");
echo "\n=== SERVICES ===\n";
foreach ($services as $s) echo "ID:{$s->id} | {$s->title} | {$s->duration}min\n";

unlink(__FILE__);
echo "\n[SCRIPT SELF-DELETED]\n";

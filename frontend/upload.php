<?php
// Простая защита — секретный ключ
$secret = "explorearmenia2026";
if (!isset($_GET['key']) || $_GET['key'] !== $secret) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden"]);
    exit;
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== 0) {
    echo json_encode(["error" => "No file"]);
    exit;
}

$file = $_FILES['file'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowed = ['jpg', 'jpeg', 'png', 'webp'];

if (!in_array($ext, $allowed)) {
    echo json_encode(["error" => "Invalid file type"]);
    exit;
}

// Уникальное имя файла
$filename = uniqid() . '_' . preg_replace('/[^a-z0-9\-_.]/', '', strtolower($file['name']));
$upload_dir = __DIR__ . '/media/';
$upload_path = $upload_dir . $filename;

if (!is_dir($upload_dir)) {
    mkdir($upload_dir, 0755, true);
}

if (move_uploaded_file($file['tmp_name'], $upload_path)) {
    $url = 'https://test.explorearmenia.am/media/' . $filename;
    echo json_encode(["url" => $url, "filename" => $filename]);
} else {
    echo json_encode(["error" => "Upload failed"]);
}
?>
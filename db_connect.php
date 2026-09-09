<?php
// Enable CORS and define response type as JSON for fetch() requests
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$servername = "localhost";
$username   = "root";
$password   = "mysql"; // AMPPS default password
$dbname     = "portal_oa";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "message" => "Sambungan database gagal: " . $conn->connect_error
    ]);
    exit();
}

// Set character set to utf8mb4
$conn->set_charset("utf8mb4");
?>
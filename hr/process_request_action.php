<?php
require_once '../db_connect.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);

if (!empty($data['id']) && !empty($data['table']) && !empty($data['action'])) {
    $id     = intval($data['id']);
    $table  = $data['table'];
    $action = $data['action']; // 'Approved', 'Revision', 'Rejected'

    $allowed_tables = ['disbursements', 'loans', 'travel'];
    if (!in_array($table, $allowed_tables)) {
        echo json_encode(["success" => false, "message" => "Invalid table"]);
        exit();
    }

    $stmt = $conn->prepare("UPDATE {$table} SET status = ? WHERE id = ?");
    $stmt->bind_param("si", $action, $id);

    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Status updated to " . $action]);
    } else {
        echo json_encode(["success" => false, "message" => $stmt->error]);
    }
} else {
    echo json_encode(["success" => false, "message" => "Missing required data"]);
}
?>
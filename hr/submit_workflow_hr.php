<?php
require_once '../db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!empty($data)) {
    $workflow_name = $data['workflowName'];
    $steps_json    = json_encode($data['steps']);

    $stmt = $conn->prepare("INSERT INTO workflows (workflow_name, steps_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE steps_json=?");
    $stmt->bind_param("sss", $workflow_name, $steps_json, $steps_json);

    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Workflow configuration saved successfully!"]);
    } else {
        echo json_encode(["success" => false, "message" => $stmt->error]);
    }
}
?>
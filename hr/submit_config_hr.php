<?php
require_once '../db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!empty($data)) {
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value=?");
        
        foreach ($data as $key => $value) {
            $val_str = is_array($value) ? json_encode($value) : $value;
            $stmt->bind_param("sss", $key, $val_str, $val_str);
            $stmt->execute();
        }

        $conn->commit();
        echo json_encode(["success" => true, "message" => "System configurations updated successfully!"]);
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(["success" => false, "message" => $e->getMessage()]);
    }
}
?>
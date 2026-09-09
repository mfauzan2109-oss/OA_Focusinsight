<?php
require_once '../db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!empty($data)) {
    $dept_name = $data['departmentName'];
    $hod       = $data['headOfDepartment'];
    $date      = $data['dateCreated'] ?? date('Y-m-d');
    $desc      = $data['description'] ?? '';

    $stmt = $conn->prepare("INSERT INTO departments (department_name, head_of_department, date_created, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE head_of_department=?, description=?");
    $stmt->bind_param("ssssss", $dept_name, $hod, $date, $desc, $hod, $desc);

    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Department saved successfully!"]);
    } else {
        echo json_encode(["success" => false, "message" => $stmt->error]);
    }
}
?>
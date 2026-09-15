<?php
require_once '../db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!empty($data)) {
    $emp_id       = $data['employeeId'];
    $full_name    = $data['fullName'];
    $email        = $data['email'];
    $ic_passport  = $data['icPassport'] ?? '';
    $phone_no     = $data['phoneNo'] ?? '';
    $emergency    = $data['emergencyContact'] ?? '';
    $address      = $data['address'] ?? '';
    $department   = $data['department'];
    $position     = $data['position'];
    $emp_type     = $data['employmentType'] ?? 'Full Time';
    $supervisor   = $data['supervisor'] ?? '';
    $join_date    = $data['joinDate'] ?? '';
    $password     = password_hash($data['employeePassword'], PASSWORD_DEFAULT);

    $sql = "INSERT INTO users (employee_id, full_name, email, ic_passport, phone_no, emergency_contact, address, department, position, employment_type, supervisor, join_date, password) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                full_name=?, email=?, ic_passport=?, phone_no=?, emergency_contact=?, address=?, department=?, position=?, employment_type=?, supervisor=?, join_date=?";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssssssssssssssssssssssss", 
        $emp_id, $full_name, $email, $ic_passport, $phone_no, $emergency, $address, $department, $position, $emp_type, $supervisor, $join_date, $password,
        $full_name, $email, $ic_passport, $phone_no, $emergency, $address, $department, $position, $emp_type, $supervisor, $join_date
    );

    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Employee account created/updated successfully!"]);
    } else {
        echo json_encode(["success" => false, "message" => $stmt->error]);
    }
}
?>
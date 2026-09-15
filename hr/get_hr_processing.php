<?php
require_once '../db_connect.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? 'get_lists';

if ($action === 'get_lists') {
    // 1. Pending Approvals: Disbursements & Loans
    $approvals = [];

    // Fetch Disbursements
    $res_disb = $conn->query("SELECT id, employee_id, employee_name, 'Disbursement Application' AS request_type, created_at FROM disbursements WHERE status = 'Pending' OR status = 'PENDING'");
    while ($row = $res_disb->fetch_assoc()) {
        $row['formatted_id'] = 'REQ-DISB-' . str_pad($row['id'], 3, '0', STR_PAD_LEFT);
        $row['source_table'] = 'disbursements';
        $approvals[] = $row;
    }

    // Fetch Loans
    $res_loans = $conn->query("SELECT id, employee_id, employee_name, 'Loan Application' AS request_type, created_at FROM loans WHERE status = 'Pending' OR status = 'PENDING'");
    while ($row = $res_loans->fetch_assoc()) {
        $row['formatted_id'] = 'REQ-LOAN-' . str_pad($row['id'], 3, '0', STR_PAD_LEFT);
        $row['source_table'] = 'loans';
        $approvals[] = $row;
    }

    // 2. Pending Bookings: Travel Applications
    $bookings = [];
    $res_travel = $conn->query("SELECT id, employee_id, employee_name, 'Travel Application' AS request_type, created_at FROM travel WHERE status = 'Pending' OR status = 'PENDING'");
    while ($row = $res_travel->fetch_assoc()) {
        $row['formatted_id'] = 'REQ-TRV-' . str_pad($row['id'], 3, '0', STR_PAD_LEFT);
        $row['source_table'] = 'travel';
        $bookings[] = $row;
    }

    echo json_encode([
        "success" => true,
        "pending_approvals" => $approvals,
        "pending_bookings" => $bookings
    ]);
    exit();
}

if ($action === 'get_details') {
    $table = $_GET['table'] ?? '';
    $id = intval($_GET['id'] ?? 0);

    if (!$table || !$id) {
        echo json_encode(["success" => false, "message" => "Invalid parameters"]);
        exit();
    }

    $request = null;
    $items = [];

    if ($table === 'disbursements') {
        $stmt = $conn->prepare("SELECT d.*, u.position FROM disbursements d LEFT JOIN users u ON d.employee_id = u.user_id WHERE d.id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $request = $stmt->get_result()->fetch_assoc();

        if ($request) {
            $request['request_type'] = 'Disbursement Application';
            $items_stmt = $conn->prepare("SELECT * FROM disbursement_items WHERE disbursement_id = ?");
            $items_stmt->bind_param("i", $id);
            $items_stmt->execute();
            $res = $items_stmt->get_result();
            while ($r = $res->fetch_assoc()) { $items[] = $r; }
        }
    } else if ($table === 'loans') {
        $stmt = $conn->prepare("SELECT l.*, u.position FROM loans l LEFT JOIN users u ON l.employee_id = u.user_id WHERE l.id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $request = $stmt->get_result()->fetch_assoc();
        if ($request) {
            $request['request_type'] = 'Loan Application';
            $request['total_amount'] = $request['amount_requested'];
        }
    } else if ($table === 'travel') {
        $stmt = $conn->prepare("SELECT t.*, u.position FROM travel t LEFT JOIN users u ON t.employee_id = u.user_id WHERE t.id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $request = $stmt->get_result()->fetch_assoc();
        if ($request) {
            $request['request_type'] = 'Travel Application';
        }
    }

    if ($request) {
        echo json_encode([
            "success" => true,
            "request" => $request,
            "items"   => $items
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "Record not found"]);
    }
    exit();
}
?>
<?php
// Panggil konfigurasi sambungan database AMPPS
require 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    
    // 1. Ambil data maklumat pekerja (ReadOnly dikendalikan sebagai default jika tiada perubahan)
    $employee_id   = isset($_POST['employee_id']) ? $_POST['employee_id'] : 'EMP4001';
    $employee_name = isset($_POST['employee_name']) ? $_POST['employee_name'] : 'Ahmad Razali';
    $department    = isset($_POST['department']) ? $_POST['department'] : 'Engineering';
    
    // 2. Ambil data butiran cuti daripada input borang
    $leave_type = $_POST['leave_type'];
    
    // Jika jenis cuti ialah "others", ambil nilai spesifikasi daripada input teks 'leave_type_others'
    if ($leave_type === 'others' && !empty($_POST['leave_type_others'])) {
        $leave_type = $_POST['leave_type_others'];
    }
    
    $start_date = $_POST['start_date'];
    $end_date   = $_POST['end_date'];
    $day_type   = $_POST['day_type'];
    $num_days   = $_POST['num_days'];
    $reason     = $_POST['reason'];
    
    $attachment_path = null;

    // 3. Proses Pengurusan Fail Dokumen Sokongan (Attachment)
    if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] == 0) {
        $target_dir = "uploads/";
        
        // Bina folder uploads sekiranya ia belum wujud di dalam direktori
        if (!file_exists($target_dir)) {
            mkdir($target_dir, 0777, true);
        }
        
        // Berikan nama fail unik berasaskan timestamp bagi mengelakkan fail bertindih
        $file_name = time() . "_" . basename($_FILES["attachment"]["name"]);
        $target_file = $target_dir . $file_name;
        
        // Pindahkan fail dari memori sementara server ke folder fizikal projek
        if (move_uploaded_file($_FILES["attachment"]["tmp_name"], $target_file)) {
            $attachment_path = $target_file;
        }
    }

    // 4. Bersihkan input data teks sebelum dimasukkan ke SQL demi keselamatan data
    $employee_id   = $conn->real_escape_string($employee_id);
    $employee_name = $conn->real_escape_string($employee_name);
    $department    = $conn->real_escape_string($department);
    $leave_type    = $conn->real_escape_string($leave_type);
    $start_date    = $conn->real_escape_string($start_date);
    $end_date      = $conn->real_escape_string($end_date);
    $day_type      = $conn->real_escape_string($day_type);
    $num_days      = $conn->real_escape_string($num_days);
    $reason        = $conn->real_escape_string($reason);
    $attachment_path = $conn->real_escape_string($attachment_path);

    // 5. Jalankan Standard Query (Sesuai untuk lajur yang mempunyai jarak & huruf besar)
    $query = "INSERT INTO `leave` 
              (`Employee ID`, `Employee Name`, `Department`, `Leave Type`, `Start Date`, `End Date`, `Day type`, `No of Days`, `Reason`, `Supporting Documen`) 
              VALUES 
              ('$employee_id', '$employee_name', '$department', '$leave_type', '$start_date', '$end_date', '$day_type', '$num_days', '$reason', '$attachment_path')";

    // 6. Laksana arahan & hantar status maklum balas kepada pengguna
    if ($conn->query($query) === TRUE) {
        echo "<script>
                alert('Leave application submitted and saved to phpMyAdmin successfully!');
                window.location.href = 'dashboard.html';
              </script>";
    } else {
        echo "Ralat Pangkalan Data: " . $conn->error;
    }

    // Tutup penggunaan sambungan
    $conn->close();
}
?>
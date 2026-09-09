const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const { safeVal, safeNum } = require('../utils/helpers');

// ==========================================================================
// API ROUTE: SUBMIT TRAVEL APPLICATION (COMPLETE ALL-COLUMN MAPPING & SAFE TRUNCATION)
// ==========================================================================
const handleTravelSubmission = (req, res) => {
    const employee_id   = safeVal(req.body.employee_id || req.body.applicant_id, 50);
    const employee_name = safeVal(req.body.employee_name, 100);
    const department    = safeVal(req.body.department, 100);
    
    let rawCompany = (req.body.company || req.body.company_name || 'focusinsight').toString().toLowerCase().trim();
    const company_name  = rawCompany.includes('fortun') ? 'fortuntech' : 'focusinsight';

    let travelDestination = safeVal(req.body.travel_destination || req.body.destination, 255) || 'N/A';
    let travelMode = safeVal(req.body.travel_mode, 100) || 'Flight';
    if (travelMode === 'others' && req.body.travel_mode_others) {
        travelMode = safeVal(req.body.travel_mode_others, 100);
    }

    const allowance_type = safeVal(req.body.allowance_type, 100) || `Travel to ${travelDestination} (${travelMode})`;
    
    const depDateVal = safeVal(req.body.expected_departure || req.body.expected_departure_date, 20);
    const claim_month = safeVal(req.body.claim_month, 20) || (depDateVal ? depDateVal.substring(0, 7) : new Date().toISOString().substring(0, 7));

    let total_amount = safeNum(req.body.total_amount);
    const venueAddress = safeVal(req.body.venue_address, 0);
    const reason = safeVal(req.body.reason, 0) || `Company: ${company_name} | Venue: ${venueAddress || 'N/A'}`;

    const attachment_path = req.file ? `uploads/${req.file.filename}` : null;

    let assigned_employees = safeVal(req.body.assigned_employees || req.body.employees_json, 0);
    if (assigned_employees && typeof assigned_employees === 'object') {
        assigned_employees = JSON.stringify(assigned_employees);
    }

    const query = `
        INSERT INTO \`travel\` 
        (
            \`employee_id\`, \`employee_name\`, \`assigned_employees\`, \`department\`, \`company_name\`, 
            \`allowance_type\`, \`claim_month\`, \`total_amount\`, \`reason\`, \`supporting_document\`, 
            \`travel_destination\`, \`travel_mode\`, \`departure_destination\`, \`arrival_destination\`, 
            \`expected_departure_date\`, \`expected_arrival_date\`, \`estimated_return_date\`, \`mileage\`, 
            \`required_accommodation\`, \`primary_contact\`, \`contact_phone\`, \`venue_address\`, 
            \`departure_channel\`, \`departure_time\`, \`arrival_time\`, \`airline\`, \`flight_type\`, 
            \`checked_baggage\`, \`flight_cost\`, \`return_channel\`, \`return_departure_time\`, 
            \`return_arrival_time\`, \`return_airline\`, \`return_flight_type\`, \`return_checked_baggage\`, 
            \`return_flight_cost\`, \`hotel_channel\`, \`hotel_name\`, \`hotel_duration\`, \`hotel_nights\`, 
            \`hotel_cost\`, \`status\`, \`created_at\`
        ) 
        VALUES (
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, 'Pending', NOW()
        )
    `;

    const values = [
        employee_id, employee_name, assigned_employees, department, company_name,
        allowance_type, claim_month, total_amount, reason, attachment_path,
        travelDestination, travelMode, safeVal(req.body.departure_destination, 255), safeVal(req.body.arrival_destination, 255),
        safeVal(req.body.expected_departure || req.body.expected_departure_date, 20), safeVal(req.body.expected_arrival || req.body.expected_arrival_date, 20), safeVal(req.body.return_date || req.body.estimated_return_date, 20), safeVal(req.body.mileage, 50),
        safeVal(req.body.accommodation || req.body.required_accommodation, 10) || 'Yes', safeVal(req.body.primary_contact, 150), safeVal(req.body.phone_number || req.body.contact_phone, 50), venueAddress,
        safeVal(req.body.dep_channel, 255), safeVal(req.body.dep_time, 20), safeVal(req.body.dep_arr_time, 20), safeVal(req.body.dep_airline, 100), safeVal(req.body.dep_airline_type, 50) || 'Direct flight',
        safeVal(req.body.dep_baggage, 50) || '25kg', safeNum(req.body.dep_price), safeVal(req.body.ret_channel, 255), safeVal(req.body.ret_time, 20),
        safeVal(req.body.ret_arr_time, 20), safeVal(req.body.ret_airline, 100), safeVal(req.body.ret_airline_type, 50) || 'Direct flight', safeVal(req.body.ret_baggage, 50) || '25kg',
        safeNum(req.body.ret_price), safeVal(req.body.hotel_channel, 255), safeVal(req.body.hotel_name, 150), safeVal(req.body.hotel_duration, 50), safeVal(req.body.hotel_nights, 50),
        safeNum(req.body.hotel_price)
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Travel Submission SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        console.log('Successfully saved travel record ID:', result.insertId);
        return res.json({ success: true, message: 'Travel application submitted successfully!' });
    });
};

router.post('/api/submit-travel', upload.single('attachment'), handleTravelSubmission);
router.post('/api/submit-allowance', upload.single('attachment'), handleTravelSubmission);

module.exports = router;

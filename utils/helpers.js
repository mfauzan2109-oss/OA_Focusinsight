function normalizeFilePath(filePath) {
    if (!filePath) return null;

    let cleanPath = filePath.replace(/\\/g, '/');

    if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
    }

    return cleanPath;
}

function safeVal(value, maxLength = 255) {
    if (
        value === undefined ||
        value === null ||
        value === '' ||
        value === 'null' ||
        value === 'undefined'
    ) {
        return null;
    }

    const stringValue = String(value).trim();
    return maxLength ? stringValue.substring(0, maxLength) : stringValue;
}

function safeNum(value) {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0.00 : parsed;
}

// Weekends excluded: Saturday (6) and Sunday (0) don't count as leave days
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}

function countBusinessDays(start, end) {
    let count = 0;
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endClamped = new Date(end);
    endClamped.setHours(0, 0, 0, 0);
    while (cursor <= endClamped) {
        if (!isWeekend(cursor)) count++;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

function getAnnualEntitlement(years) {
    if (years <= 1) return 12;
    if (years === 2) return 14;
    if (years === 3) return 16;
    if (years === 4) return 18;
    if (years === 5) return 20;
    return 22;
}

function getSickEntitlement(years) {
    if (years < 2) return 14;
    if (years < 5) return 18;
    return 22;
}

module.exports = {
    normalizeFilePath,
    safeVal,
    safeNum,
    isWeekend,
    countBusinessDays,
    getAnnualEntitlement,
    getSickEntitlement
};

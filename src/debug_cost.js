function stripQuotes(s) {
    return s.replace(/["״׳'`'"]/g, '').trim();
}
function normalizeUnit(unit) {
    return stripQuotes(unit);
}
function toBaseUnit(qty, unit) {
    const u = normalizeUnit(unit);
    switch (u) {
        case 'קג':
            return { value: qty * 1000, family: 'weight' };
        case 'גרם':
            return { value: qty, family: 'weight' };
        case 'ליטר':
            return { value: qty * 1000, family: 'volume' };
        case 'מל':
            return { value: qty, family: 'volume' };
        default:
            return { value: qty, family: 'unit' };
    }
}
function calcProportionalCost(usedQty, usedUnit, invQty, invUnit, totalPrice) {
    if (!usedQty || !invQty || !totalPrice) return 0;
    const used = toBaseUnit(usedQty, usedUnit);
    const inv = toBaseUnit(invQty, invUnit);
    console.log("used:", used, "inv:", inv);
    if (used.family !== inv.family) {
        console.log("families don't match, returning 0");
        return 0;
    }
    const ratio = used.value / inv.value;
    return Math.round(ratio * totalPrice * 100) / 100;
}

// Emulate setting 100 gram to something that initially had 1 unit = ₪125
console.log("Result:", calcProportionalCost(100, 'גרם', 1, "יח'", 125));

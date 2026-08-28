-- Atomic, database-backed sequence for voucher numbering (spec 0002:
-- explicitly not Math.random() -- must be collision-resistant under
-- concurrent submissions).
CREATE SEQUENCE IF NOT EXISTS voucher_no_seq START 1;

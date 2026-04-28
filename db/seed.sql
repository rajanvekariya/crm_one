INSERT INTO admins (email, password)
VALUES ('admin@crmone.com', '$2b$10$cP3fHE3RNVM0f9YhWRWeuORkXJr11049VuWN3PaHyv3jHkX6gRahm')
ON CONFLICT (email) DO UPDATE
SET password = EXCLUDED.password;

INSERT INTO plans (name, price_yearly, price_monthly, max_users, billing_cycle)
VALUES
    ('Startup', 3000, 300, 5, 'yearly'),
    ('Professional', 6000, 600, 50, 'yearly'),
    ('Enterprise', 12000, 1200, 100, 'yearly')
ON CONFLICT (name) DO UPDATE
SET
    price_yearly = EXCLUDED.price_yearly,
    price_monthly = EXCLUDED.price_monthly,
    max_users = EXCLUDED.max_users,
    billing_cycle = EXCLUDED.billing_cycle;

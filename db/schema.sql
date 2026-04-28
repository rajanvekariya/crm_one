CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    price_yearly INT NOT NULL,
    price_monthly INT NOT NULL,
    max_users INT NOT NULL,
    billing_cycle VARCHAR(20) DEFAULT 'yearly' CHECK (billing_cycle IN ('yearly', 'monthly'))
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    country VARCHAR(100) NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    plan_id INT REFERENCES plans(id) ON DELETE SET NULL,
    billing_cycle VARCHAR(20) DEFAULT 'yearly' CHECK (billing_cycle IN ('yearly', 'monthly')),
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

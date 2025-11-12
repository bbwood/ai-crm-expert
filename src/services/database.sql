-- Database Schema for AI CRM Expert
-- This can be used with PostgreSQL, MySQL, or SQLite with minor adjustments

-- Customers table
CREATE TABLE customers (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  visit_count INTEGER DEFAULT 1,
  last_visit_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table
CREATE TABLE vehicles (
  id VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255) REFERENCES customers(id),
  year INTEGER,
  make VARCHAR(100),
  model VARCHAR(100),
  vin VARCHAR(17),
  plate VARCHAR(20),
  current_est_mileage INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service visits table
CREATE TABLE service_visits (
  visit_id VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255) REFERENCES customers(id),
  vehicle_id VARCHAR(255) REFERENCES vehicles(id),
  date DATE NOT NULL,
  mileage INTEGER,
  advisor VARCHAR(255),
  technician VARCHAR(255),
  amount DECIMAL(10, 2),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Work items table
CREATE TABLE work_items (
  id SERIAL PRIMARY KEY,
  visit_id VARCHAR(255) REFERENCES service_visits(visit_id),
  description TEXT NOT NULL,
  category VARCHAR(100),
  cost DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recommendations table
CREATE TABLE recommendations (
  id SERIAL PRIMARY KEY,
  visit_id VARCHAR(255) REFERENCES service_visits(visit_id),
  customer_id VARCHAR(255) REFERENCES customers(id),
  vehicle_id VARCHAR(255) REFERENCES vehicles(id),
  description TEXT NOT NULL,
  estimated_cost DECIMAL(10, 2),
  category VARCHAR(100),
  urgency VARCHAR(50),
  status VARCHAR(50),
  date_recommended DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI runs log table (core logging for the system)
CREATE TABLE ai_runs (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(255) REFERENCES customers(id),
  vehicle_id VARCHAR(255),
  task_type VARCHAR(100) NOT NULL,
  system_name VARCHAR(255) NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  meta_name VARCHAR(255) NOT NULL,
  context_snapshot JSONB NOT NULL,
  final_message TEXT NOT NULL,
  clarity_score INTEGER,
  trust_tone_score INTEGER,
  retention_impact_score INTEGER,
  outcome VARCHAR(255),
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message outcomes table (track customer responses)
CREATE TABLE message_outcomes (
  id SERIAL PRIMARY KEY,
  ai_run_id INTEGER REFERENCES ai_runs(id),
  outcome_type VARCHAR(100) NOT NULL, -- 'replied', 'booked', 'ignored', 'unsubscribed'
  outcome_data JSONB,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shop configuration table
CREATE TABLE shop_config (
  id SERIAL PRIMARY KEY,
  shop_name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_vehicles_vin ON vehicles(vin);
CREATE INDEX idx_service_visits_customer ON service_visits(customer_id);
CREATE INDEX idx_service_visits_date ON service_visits(date);
CREATE INDEX idx_ai_runs_customer ON ai_runs(customer_id);
CREATE INDEX idx_ai_runs_task_type ON ai_runs(task_type);
CREATE INDEX idx_ai_runs_created_at ON ai_runs(created_at);
CREATE INDEX idx_recommendations_customer ON recommendations(customer_id);
CREATE INDEX idx_recommendations_status ON recommendations(status);

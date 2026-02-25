-- =====================================================
-- ISMS Database Schema
-- Integrated Security Management System
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Operations Manager', 'Guard', 'Client')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    department VARCHAR(100),
    last_active TIMESTAMP,
    email_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CLIENTS & CONTRACTS
-- =====================================================

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    total_guards INTEGER DEFAULT 0,
    monthly_value DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_code VARCHAR(20) UNIQUE NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    guards_required INTEGER DEFAULT 0,
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_code VARCHAR(20) UNIQUE NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    value DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'expired', 'terminated')),
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'quarterly', 'annually')),
    sla_response VARCHAR(50),
    auto_renew BOOLEAN DEFAULT FALSE,
    terms_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PERSONNEL (GUARDS)
-- =====================================================

CREATE TABLE personnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_code VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    psra_license VARCHAR(50),
    psra_expiry DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'on-leave', 'inactive', 'suspended')),
    current_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    join_date DATE,
    training_hours INTEGER DEFAULT 0,
    rating DECIMAL(2, 1) DEFAULT 0.0,
    shifts_completed INTEGER DEFAULT 0,
    incidents_reported INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'valid' CHECK (status IN ('valid', 'expiring', 'expired')),
    file_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SCHEDULING & SHIFTS
-- =====================================================

CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_code VARCHAR(20) UNIQUE NOT NULL,
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'missed', 'cancelled')),
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INCIDENTS
-- =====================================================

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    reported_by UUID REFERENCES personnel(id) ON DELETE SET NULL,
    timestamp TIMESTAMP NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    category VARCHAR(100),
    location VARCHAR(255),
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    response_time INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incident_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    file_name VARCHAR(255),
    file_url VARCHAR(500),
    file_type VARCHAR(50),
    file_size INTEGER,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PATROL & GPS TRACKING
-- =====================================================

CREATE TABLE patrol_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_code VARCHAR(20) UNIQUE NOT NULL,
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    checkpoints_total INTEGER DEFAULT 0,
    checkpoints_completed INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'deviation', 'delayed')),
    distance DECIMAL(10, 2),
    duration INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patrol_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES patrol_routes(id) ON DELETE CASCADE,
    checkpoint_name VARCHAR(255),
    expected_time TIME,
    actual_time TIMESTAMP,
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'missed')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CCTV & ALARMS
-- =====================================================

CREATE TABLE cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online', 'offline', 'motion-detected', 'maintenance')),
    recording_enabled BOOLEAN DEFAULT TRUE,
    stream_url VARCHAR(500),
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE camera_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id UUID REFERENCES cameras(id) ON DELETE CASCADE,
    event_type VARCHAR(50),
    timestamp TIMESTAMP NOT NULL,
    description TEXT,
    snapshot_url VARCHAR(500),
    video_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- DRONE OPERATIONS
-- =====================================================

CREATE TABLE drones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drone_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    model VARCHAR(100),
    serial_number VARCHAR(100) UNIQUE,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in-flight', 'maintenance', 'retired')),
    battery_level INTEGER DEFAULT 100,
    flight_hours DECIMAL(10, 2) DEFAULT 0,
    last_maintenance DATE,
    next_maintenance DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flight_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_code VARCHAR(20) UNIQUE NOT NULL,
    drone_id UUID REFERENCES drones(id) ON DELETE CASCADE,
    pilot_id UUID REFERENCES personnel(id) ON DELETE SET NULL,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    mission_name VARCHAR(255),
    flight_date DATE,
    takeoff_time TIME,
    landing_time TIME,
    duration INTEGER,
    status VARCHAR(20) CHECK (status IN ('scheduled', 'in-flight', 'completed', 'aborted', 'reviewing')),
    purpose TEXT,
    altitude DECIMAL(10, 2),
    distance DECIMAL(10, 2),
    battery_used INTEGER,
    video_footage BOOLEAN DEFAULT FALSE,
    photo_count INTEGER DEFAULT 0,
    incident_linked UUID REFERENCES incidents(id),
    weather_conditions TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INVENTORY MANAGEMENT
-- =====================================================

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('Uniform', 'Equipment', 'Vehicle', 'Firearm', 'Communication', 'Technology')),
    serial_number VARCHAR(100),
    quantity INTEGER,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance', 'retired')),
    condition VARCHAR(20) CHECK (condition IN ('new', 'good', 'fair', 'poor')),
    assigned_to UUID REFERENCES personnel(id) ON DELETE SET NULL,
    location VARCHAR(255),
    purchase_date DATE,
    purchase_price DECIMAL(12, 2),
    current_value DECIMAL(12, 2),
    last_maintenance DATE,
    next_maintenance DATE,
    warranty_expiry DATE,
    supplier VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- BILLING & INVOICES
-- =====================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_code VARCHAR(20) UNIQUE NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'overdue', 'cancelled')),
    period_start DATE,
    period_end DATE,
    billing_period VARCHAR(100),
    payment_date DATE,
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(12, 2),
    total_price DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_code VARCHAR(20) UNIQUE NOT NULL,
    type VARCHAR(50) CHECK (type IN ('incident', 'system', 'personnel', 'client', 'maintenance', 'alert')),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    category VARCHAR(100),
    action_required BOOLEAN DEFAULT FALSE,
    link VARCHAR(500),
    recipient_type VARCHAR(50) CHECK (recipient_type IN ('all', 'admins', 'operations', 'guards', 'clients')),
    read_by JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CLIENT PORTAL
-- =====================================================

CREATE TABLE portal_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    role VARCHAR(50) CHECK (role IN ('primary', 'secondary', 'viewer')),
    access_level VARCHAR(50) CHECK (access_level IN ('full', 'limited', 'read-only')),
    view_incidents BOOLEAN DEFAULT FALSE,
    view_cctv BOOLEAN DEFAULT FALSE,
    view_invoices BOOLEAN DEFAULT FALSE,
    view_reports BOOLEAN DEFAULT FALSE,
    submit_requests BOOLEAN DEFAULT FALSE,
    view_personnel BOOLEAN DEFAULT FALSE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_code VARCHAR(20) UNIQUE NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('incident', 'complaint', 'additional-service', 'maintenance', 'general')),
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
    submitted_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    submitted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_date TIMESTAMP,
    response_time INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ACTIVITY LOGS & AUDIT TRAIL
-- =====================================================

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- Clients & Sites
CREATE INDEX idx_clients_client_code ON clients(client_code);
CREATE INDEX idx_sites_client_id ON sites(client_id);
CREATE INDEX idx_sites_site_code ON sites(site_code);

-- Personnel
CREATE INDEX idx_personnel_guard_code ON personnel(guard_code);
CREATE INDEX idx_personnel_status ON personnel(status);
CREATE INDEX idx_personnel_current_site ON personnel(current_site_id);

-- Incidents
CREATE INDEX idx_incidents_incident_code ON incidents(incident_code);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_site_id ON incidents(site_id);
CREATE INDEX idx_incidents_timestamp ON incidents(timestamp DESC);

-- Shifts
CREATE INDEX idx_shifts_personnel_id ON shifts(personnel_id);
CREATE INDEX idx_shifts_site_id ON shifts(site_id);
CREATE INDEX idx_shifts_shift_date ON shifts(shift_date);
CREATE INDEX idx_shifts_status ON shifts(status);

-- Invoices
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- Notifications
CREATE INDEX idx_notifications_recipient_type ON notifications(recipient_type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personnel_updated_at BEFORE UPDATE ON personnel
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE DATABASE IF NOT EXISTS support_copilot;
USE support_copilot;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(300) NOT NULL,
  role ENUM('admin', 'agent') NOT NULL DEFAULT 'agent',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4;

-- Phase 2: knowledge base
CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  filename VARCHAR(255) NULL,
  uploaded_by INT NULL,
  passage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS passages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  position INT NOT NULL,
  content TEXT NOT NULL,
  FULLTEXT KEY ft_content (content),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

-- Phase 3: customer tickets
-- status: new (being drafted), draft_ready (AI draft waiting for a person), escalated (needs a person), replied (a person approved and sent a reply)
-- reply_kind: draft_unchanged, draft_edited or written; email_status: sent, failed or not_configured
CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  customer_email VARCHAR(150) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  ai_draft TEXT NULL,
  drafted_by VARCHAR(20) NULL,
  sources TEXT NULL,
  escalation_reason VARCHAR(255) NULL,
  reply_text TEXT NULL,
  reply_kind VARCHAR(20) NULL,
  replied_by INT NULL,
  replied_at TIMESTAMP NULL DEFAULT NULL,
  email_status VARCHAR(20) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) DEFAULT CHARSET=utf8mb4;

-- Phase 4: answers a person suggests adding to the knowledge base (an admin approves them)
CREATE TABLE IF NOT EXISTS kb_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  suggested_by INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_ticket (ticket_id),
  INDEX idx_suggestion_status (status),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

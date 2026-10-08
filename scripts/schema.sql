-- Optional: run this in the Neon SQL editor. The app also creates these tables automatically on first request.
CREATE TABLE IF NOT EXISTS users (
    id            text PRIMARY KEY,
    name          text NOT NULL,
    email         text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
    id         text PRIMARY KEY,
    data       jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
    id             text PRIMARY KEY,
    user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id       text NOT NULL,
    tier           text NOT NULL,
    quantity       integer NOT NULL,
    amount         integer NOT NULL,
    attendee_name  text NOT NULL,
    attendee_email text NOT NULL,
    attendee_phone text NOT NULL,
    id_type        text NOT NULL,
    id_last4       text NOT NULL,
    event_title    text,
    event_venue    text,
    event_city     text,
    event_date     text,
    event_time     text,
    event_image    text,
    status         text NOT NULL DEFAULT 'pending',
    ticket_code    text UNIQUE,
    payment_method text,
    paid_at        timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS login_attempts (
    email      text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_idx ON login_attempts (email, created_at);

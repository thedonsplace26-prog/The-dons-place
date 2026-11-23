CREATE TABLE apartments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text UNIQUE NOT NULL,
 name text NOT NULL,
 blurb text NOT NULL,
 description text NOT NULL DEFAULT '',
 price_per_night integer NOT NULL CHECK (price_per_night >= 0),
 highlights jsonb NOT NULL DEFAULT '[]',
 amenities jsonb NOT NULL DEFAULT '[]',
 is_available boolean NOT NULL DEFAULT true,
 is_featured boolean NOT NULL DEFAULT false,
 is_sample boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0,
 cover_photo_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 apartment_id uuid REFERENCES apartments(id) ON DELETE CASCADE,
 storage_key text NOT NULL,
 url text NOT NULL,
 thumb_url text,
 alt text NOT NULL DEFAULT '',
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE apartments ADD CONSTRAINT apartment_cover_fk FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL;
CREATE INDEX photos_apartment_order_idx ON photos(apartment_id, sort_order);
CREATE TABLE settings (
 key text PRIMARY KEY,
 value jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 username text UNIQUE NOT NULL,
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_login_at timestamptz
);
CREATE TABLE session (
 sid varchar PRIMARY KEY,
 sess json NOT NULL,
 expire timestamp(6) NOT NULL
);
CREATE INDEX session_expire_idx ON session(expire);
CREATE TABLE login_attempts (
 ip text PRIMARY KEY,
 attempts integer NOT NULL DEFAULT 0,
 reset_at timestamptz NOT NULL
);
CREATE TABLE storage_deletions (
 storage_key text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_seed (
 key text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now()
);

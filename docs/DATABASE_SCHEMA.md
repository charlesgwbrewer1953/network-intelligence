TABLE agents: 
agent_id
name
hostname
location
ip_address
mac_address
created_at
last_seen
TABLE devices:
device_id
primary_mac
user_name
hostname
manufacturer
device_type
location
first_seen
last_seen
notes
TABLE scans:
scan_id
agent_id
started_at
finished_at
devices_found
TABLE scan_observations
observation_id
scan_id
device_id
observed_mac
ip_address
hostname
latency_ms
seen_at
TABLE device_history:
history_id
device_id
event_type
old_value
new_value
event_time

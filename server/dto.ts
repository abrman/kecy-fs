import { type ActivityRow, type UploadWithDevice, deviceLabel, isLocked } from "./db";

export function activityDto(a: ActivityRow) {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    deadline: a.deadline,
    isPublic: a.is_public === 1,
    locked: isLocked(a),
    createdAt: a.created_at,
  };
}

export function uploadDto(u: UploadWithDevice) {
  return {
    id: u.id,
    activityId: u.activity_id,
    deviceId: u.device_id,
    deviceLabel: deviceLabel({ name: u.device_name, codename: u.codename }),
    originalName: u.original_name,
    mime: u.mime,
    size: u.size,
    createdAt: u.created_at,
  };
}

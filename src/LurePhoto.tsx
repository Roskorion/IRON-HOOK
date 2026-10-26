import { useState } from "react";
export default function LurePhoto({
  photo,
  name,
}: {
  photo: string;
  name: string;
}) {
  const [failed, setFailed] = useState("");
  return photo && failed !== photo ? (
    <img
      src={photo}
      alt={name}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(photo)}
    />
  ) : (
    <span className="photo-placeholder">
      {photo ? "Фото недоступно" : "Фото не добавлено"}
    </span>
  );
}

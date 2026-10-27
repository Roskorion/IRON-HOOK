import { useState } from "react";
import cachedPhotos from "./lure-photo-cache.json";

const photoCache: Record<string, string> = cachedPhotos;
export default function LurePhoto({
  photo,
  name,
}: {
  photo: string;
  name: string;
}) {
  const [failed, setFailed] = useState("");
  const local = photoCache[photo];
  const src = local ? `${import.meta.env.BASE_URL}${local}` : photo;
  return photo && failed !== src ? (
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
    />
  ) : (
    <span className="photo-placeholder">
      {photo ? "Фото недоступно" : "Фото не добавлено"}
    </span>
  );
}

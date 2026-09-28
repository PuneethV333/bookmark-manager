import { useState } from "react";
import { FiImage } from "react-icons/fi";
import { cn } from "../utils/cn";

interface CoverImageProps {
  src?: string;
  className?: string;
}

/** Decorative cover art with a placeholder when the image is missing or blocked. */
const CoverImage = ({ src, className }: CoverImageProps) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div aria-hidden className={cn("grid place-items-center bg-ink-800 text-3xl text-ink-600", className)}>
        <FiImage />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("object-cover object-top", className)}
    />
  );
};

export default CoverImage;

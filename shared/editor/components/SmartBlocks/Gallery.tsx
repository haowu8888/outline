import { BackIcon, CloseIcon, ImageIcon, NextIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "../../../styles";
import { GalleryData, blockId, safeImageSource } from "../../lib/smartBlocks";
import {
  BlockProps,
  BlockTitle,
  Button,
  Empty,
  ErrorText,
  Hint,
  IconButton,
  Input,
  Row,
  TextField,
} from "./common";

export default function Gallery({
  data,
  editable,
  update,
  uploadFile,
}: BlockProps<GalleryData>) {
  const { t } = useTranslation();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [current, setCurrent] = React.useState(0);
  const carousel = data.layout === "carousel";

  const addImages = (sources: string[]) =>
    update((value) => ({
      ...value,
      images: [
        ...value.images,
        ...sources.map((src) => ({ id: blockId(), src, caption: "" })),
      ],
    }));

  const handleFiles = async (files: File[]) => {
    if (!uploadFile || !files.length) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const sources = await Promise.all(files.map((file) => uploadFile(file)));
      addImages(sources.map(safeImageSource).filter(Boolean));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUrl = () => {
    const src = safeImageSource(url);
    if (!src) {
      setError(t("Enter an image link starting with http:// or https://"));
      return;
    }
    setError("");
    addImages([src]);
    setUrl("");
  };

  const index = Math.min(current, Math.max(0, data.images.length - 1));
  const image = data.images[index];
  const move = (step: number) =>
    setCurrent((index + step + data.images.length) % data.images.length);

  return (
    <>
      <BlockTitle
        value={data.title}
        placeholder={t("Gallery")}
        editable={editable}
        onCommit={(title) => update((value) => ({ ...value, title }))}
      />
      {editable && (
        <Row>
          <Button
            type="button"
            aria-pressed={!carousel}
            $primary={!carousel}
            onClick={() => update((value) => ({ ...value, layout: "grid" }))}
          >
            {t("Grid")}
          </Button>
          <Button
            type="button"
            aria-pressed={carousel}
            $primary={carousel}
            onClick={() =>
              update((value) => ({ ...value, layout: "carousel" }))
            }
          >
            {t("Carousel")}
          </Button>
        </Row>
      )}
      {!data.images.length ? (
        <Empty>{t("No images yet")}</Empty>
      ) : carousel ? (
        <Carousel>
          <figure>
            <a href={image.src} target="_blank" rel="noopener noreferrer">
              <img src={image.src} alt={image.caption} />
            </a>
            {image.caption && <figcaption>{image.caption}</figcaption>}
          </figure>
          {data.images.length > 1 && (
            <Row>
              <IconButton
                type="button"
                aria-label={t("Previous")}
                onClick={() => move(-1)}
              >
                <BackIcon />
              </IconButton>
              <Hint>
                {index + 1} / {data.images.length}
              </Hint>
              <IconButton
                type="button"
                aria-label={t("Next")}
                onClick={() => move(1)}
              >
                <NextIcon />
              </IconButton>
            </Row>
          )}
        </Carousel>
      ) : null}
      {data.images.length > 0 && (!carousel || editable) && (
        <Grid>
          {data.images.map((item, i) => (
            <figure key={item.id}>
              <a href={item.src} target="_blank" rel="noopener noreferrer">
                <img src={item.src} alt={item.caption} loading="lazy" />
              </a>
              {editable ? (
                <Caption>
                  <TextField
                    value={item.caption}
                    placeholder={t("Caption")}
                    aria-label={t("Caption")}
                    onCommit={(caption) =>
                      update((value) => ({
                        ...value,
                        images: value.images.map((entry) =>
                          entry.id === item.id ? { ...entry, caption } : entry
                        ),
                      }))
                    }
                  />
                  <IconButton
                    type="button"
                    title={t("Delete image")}
                    aria-label={t("Delete image")}
                    onClick={() => {
                      if (i < index) {
                        setCurrent(index - 1);
                      }
                      update((value) => ({
                        ...value,
                        images: value.images.filter(
                          (entry) => entry.id !== item.id
                        ),
                      }));
                    }}
                  >
                    <CloseIcon size={18} />
                  </IconButton>
                </Caption>
              ) : (
                item.caption && <figcaption>{item.caption}</figcaption>
              )}
            </figure>
          ))}
        </Grid>
      )}
      {editable && (
        <Row>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void handleFiles(files);
            }}
          />
          {uploadFile && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <ImageIcon size={18} />
              {busy ? `${t("Uploading")}…` : t("Upload images")}
            </Button>
          )}
          <Input
            type="url"
            value={url}
            placeholder="https://"
            aria-label={t("Image link")}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleUrl();
              }
            }}
          />
          <Button type="button" onClick={handleUrl}>
            {t("Add link")}
          </Button>
        </Row>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </>
  );
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
  margin-top: 8px;

  figure {
    margin: 0;
  }

  img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: 4px;
    background: ${s("backgroundSecondary")};
  }

  figcaption {
    margin-top: 4px;
    color: ${s("textSecondary")};
    font-size: 13px;
    text-align: center;
  }
`;

const Caption = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;

  input {
    flex: 1;
    width: 100%;
    font-size: 13px;
  }
`;

const Carousel = styled.div`
  margin-top: 8px;

  figure {
    margin: 0;
    text-align: center;
  }

  img {
    max-width: 100%;
    max-height: 480px;
    border-radius: 4px;
  }

  figcaption {
    color: ${s("textSecondary")};
    font-size: 13px;
  }

  > div {
    justify-content: center;
  }
`;

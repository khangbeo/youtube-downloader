import { isValidYouTubeUrl, getTitleAndThumbnail } from "../utils/utils";
import { v4 as uuidv4 } from "uuid";
const Form = ({
  url,
  setUrl,
  format,
  setFormat,
  resolution,
  setResolution,
  addToQueue,
  isConverting,
  setMessage,
  queue,
}) => {
  const handleAddToQueue = async (event) => {
    event.preventDefault();

    if (isConverting) {
      setMessage("Converting in progress, please wait until finished.");
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      setMessage("Please enter a valid YouTube URL");
      return;
    }

    if (resolution === "Choose resolution") {
      setMessage("You need to pick a resolution");
      return;
    }

    if (url) {
      const { title, thumbnail } = await getTitleAndThumbnail(url);

      const newItem = {
        url,
        title,
        thumbnail,
        status: "pending",
        jobId: uuidv4(),
      };

      const exists = queue.some((item) => item.url === newItem.url);
      if (exists) {
        setMessage("You already added this video, add a new one");
        setUrl("");
        return;
      }

      addToQueue(newItem);
      setUrl("");
      setMessage("");
    }
  };

  return (
    <form
      className="join join-vertical items-center w-full m-4"
      onSubmit={handleAddToQueue}
    >
      <div className="join join-item flex flex-col">
        <label>
          <div className="label">
            <span className="label-text">Enter YouTube Video URL</span>
          </div>
        </label>
        <input
          className="input input-bordered bg-slate-100 w-full max-w-xs mb-2"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=r39bqo510g"
          disabled={isConverting}
        />
        <button
          className="btn btn-accent"
          type="submit"
          disabled={isConverting}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          Add to Queue
        </button>
      </div>

      <div className="flex flex-col items-center">
        <div className="join-item flex my-3">
          <label className="label cursor-pointer">
            <input
              className="radio radio-accent"
              type="radio"
              value="mp4"
              checked={format === "mp4"}
              onChange={() => setFormat("mp4")}
            />
            <span className="label-text-lg mx-2 text-base-content">MP4</span>
          </label>
          <label className="label cursor-pointer">
            <input
              className="radio radio-accent"
              type="radio"
              value="mp3"
              checked={format === "mp3"}
              onChange={() => setFormat("mp3")}
            />
            <span className="label-text-lg mx-2 text-base-content">MP3</span>
          </label>
        </div>

        <div className="join-item flex">
          <select
            className="select select-bordered w-full max-w-xs bg-slate-100"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          >
            <option value="Choose resolution">Choose resolution</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
            <option value="360p">360p</option>
            <option value="240p">240p</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default Form;

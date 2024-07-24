const Queue = ({
  queue,
  processing,
  progress,
  removeFromQueue,
  convertVideo,
  isConverting,
  retryFailedConversions,
  clearQueue,
  title = "Queue",
  downloadFile,
}) => {
  return (
    <div className="flex flex-col items-center border m-4 p-4 rounded-xl bg-accent w-10/12 md:w-9/12 lg:w-5/12 ">
      <h2 className="text-2xl font-bold text-base-100">{title}</h2>
      {queue.length === 0 && <p>Add videos to the queue!</p>}
      <ul className="my-4 w-full">
        {queue.map((item, index) => (
          <li key={index} className="flex items-center relative my-3">
            <div className="relative w-20 h-20 flex-shrink-0">
              <img
                src={item.thumbnail}
                alt={item.title}
                className="object-cover w-full h-full rounded-2xl"
                style={{ opacity: item.status === "converting" ? 0.5 : 1 }}
              />
              {processing[item.title] && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">
                    {progress[item.title]}%
                  </span>
                </div>
              )}
            </div>
            <div className="flex-grow mx-4">
              <div className="font-bold text-xl text-base-100">
                {item.title}
              </div>
            </div>
            {!isConverting && title !== "Completed" && (
              <button
                className="btn btn-circle btn-ghost"
                onClick={() => removeFromQueue(index)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
      {title === "Queue" ? (
        <>
          {queue.some((item) => item.status === "failed") ? (
            <button
              className="btn w-full m-2"
              onClick={retryFailedConversions}
              disabled={isConverting}
            >
              Retry Failed Conversions
            </button>
          ) : (
            <button
              className="btn w-full m-2"
              onClick={convertVideo}
              disabled={isConverting}
            >
              {isConverting ? (
                <span className="loading loading-spinner"></span>
              ) : (
                <>Convert</>
              )}
            </button>
          )}
          <button
            className="btn btn-error w-full m-2"
            onClick={clearQueue}
            disabled={isConverting}
          >
            Clear
          </button>
        </>
      ) : (
        <>
          <button
            className="btn w-full m-2"
            onClick={() =>
              queue.forEach((item) =>
                downloadFile(item.downloadUrl, item.originalTitle)
              )
            }
          >
            Download Video(s)
          </button>
        </>
      )}
    </div>
  );
};

export default Queue;

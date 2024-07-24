"use client";
import { useState, useEffect } from "react";
import axios from "axios";

import Form from "./components/Form";
import Queue from "./components/Queue";
import Error from "./components/Error"; // Import the Error component

export default function Home({ theme }) {
    const [url, setUrl] = useState("");
    const [queue, setQueue] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [format, setFormat] = useState("mp4");
    const [resolution, setResolution] = useState("1080p");
    const [processing, setProcessing] = useState({});
    const [progress, setProgress] = useState({});
    const [message, setMessage] = useState("");
    const [isConverting, setIsConverting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const addToQueue = (newItem) => {
        setQueue((prevQueue) => [...prevQueue, newItem]);
        setProcessing((prevProcessing) => ({
            ...prevProcessing,
            [newItem.title]: false,
        }));
    };

    useEffect(() => {
        const eventSource = new EventSource("/api/download/progress");
        eventSource.onmessage = (event) => {
            const { title, processing, progress } = JSON.parse(event.data);
            setProcessing((prevProcessing) => ({
                ...prevProcessing,
                [title]: processing,
            }));
            setProgress((prevProgress) => ({
                ...prevProgress,
                [title]: progress,
            }));
        };
        return () => {
            eventSource.close();
        };
    }, []);

    const convertVideo = async () => {
        setIsConverting(true);

        for (let item of queue) {
            setProcessing((prevProcessing) => ({
                ...prevProcessing,
                [item.title]: true,
            }));
            item.status = "converting";

            try {
                const response = await axios.post("/api/download", {
                    url: item.url,
                    format: format,
                    resolution: resolution,
                    jobId: item.jobId,
                });

                if (response.data.message) {
                    setMessage(response.data.message);
                }

                item.downloadUrl = response.data.downloadUrl;
                item.originalTitle = response.data.originalTitle; // Store original title
                item.status = "complete";
                setProcessing((prevProcessing) => ({
                    ...prevProcessing,
                    [item.title]: false,
                }));

                // Move the item to the completed list
                setCompleted((prevCompleted) => [
                    ...prevCompleted,
                    {
                        ...item,
                        downloadUrl: response.data.downloadUrl,
                        originalTitle: response.data.originalTitle,
                    },
                ]);

                // Update the queue item status
                setQueue((prevQueue) =>
                    prevQueue.map((queueItem) =>
                        queueItem.jobId === item.jobId
                            ? { ...queueItem, status: "complete" }
                            : queueItem
                    )
                );
            } catch (e) {
                console.log(e);
                item.status = "failed";
                setMessage("Video conversion failed. Please try again.");
                setProcessing((prevProcessing) => ({
                    ...prevProcessing,
                    [item.title]: false,
                }));
            }
        }

        setIsConverting(false);
        setCurrentPage(3); // Automatically switch to the completed page
    };

    const clearQueue = async () => {
        for (let item of queue) {
            if (item.status === "converting") {
                await axios.delete("/api/download", {
                    data: { jobId: item.jobId },
                });
            }
        }
        setQueue([]);
        setProcessing({});
        setMessage("");
    };

    const removeFromQueue = async (index) => {
        const item = queue[index];
        if (item.status === "converting") {
            await axios.delete("/api/download", {
                data: { jobId: item.jobId },
            });
        }

        const newQueue = queue.filter((_, i) => i !== index);
        setQueue(newQueue);
        const newProcessing = { ...processing };
        delete newProcessing[item.title];
        setProcessing(newProcessing);
    };

    const downloadFile = (url, title) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title}.${format}`; // Use original title with format
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const startNewSession = () => {
        setCompleted([]);
        setQueue([]);
        setMessage("");
        setCurrentPage(1); // Reset to form page
    };

    const retryFailedConversions = async () => {
        const failedItems = queue.filter((item) => item.status === "failed");
        setIsConverting(true);
        for (let item of failedItems) {
            setProcessing((prevProcessing) => ({
                ...prevProcessing,
                [item.title]: true,
            }));
            item.status = "converting";

            try {
                const response = await axios.post("/api/download", {
                    url: item.url,
                    format: format,
                    resolution: resolution,
                    jobId: item.jobId,
                });

                if (response.data.message) {
                    setMessage(response.data.message);
                }

                item.downloadUrl = response.data.downloadUrl;
                item.originalTitle = response.data.originalTitle; // Store original title
                item.status = "complete";
                setProcessing((prevProcessing) => ({
                    ...prevProcessing,
                    [item.title]: false,
                }));

                // Move the item to the completed list
                setCompleted((prevCompleted) => [
                    ...prevCompleted,
                    {
                        ...item,
                        downloadUrl: response.data.downloadUrl,
                        originalTitle: response.data.originalTitle,
                    },
                ]);

                // Update the queue item status
                setQueue((prevQueue) =>
                    prevQueue.map((queueItem) =>
                        queueItem.jobId === item.jobId
                            ? { ...queueItem, status: "complete" }
                            : queueItem
                    )
                );
            } catch (e) {
                console.log(e);
                item.status = "failed";
                setMessage("Video conversion failed. Please try again.");
                setProcessing((prevProcessing) => ({
                    ...prevProcessing,
                    [item.title]: false,
                }));
            }
        }

        setIsConverting(false);
    };

    return (
        <main className="flex flex-col min-h-screen items-center justify-center">
            {message && <Error message={message} />}{" "}
            {/* Use the Error component */}
            {currentPage === 1 && (
                <Form
                    url={url}
                    setUrl={setUrl}
                    format={format}
                    setFormat={setFormat}
                    resolution={resolution}
                    setResolution={setResolution}
                    addToQueue={addToQueue}
                    isConverting={isConverting}
                    setMessage={setMessage}
                    queue={queue}
                />
            )}
            {(currentPage === 2 || currentPage === 3) && (
                <Queue
                    queue={currentPage === 2 ? queue : completed}
                    processing={processing}
                    progress={progress}
                    removeFromQueue={removeFromQueue}
                    convertVideo={convertVideo}
                    isConverting={isConverting}
                    retryFailedConversions={retryFailedConversions}
                    clearQueue={clearQueue}
                    title={currentPage === 2 ? "Queue" : "Completed"}
                    downloadFile={downloadFile}
                    downloadAll={currentPage === 3}
                />
            )}
            <div className="flex justify-center w-full">
                {currentPage === 2 && (
                    <button
                        className="btn btn-secondary"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={isConverting}
                    >
                        Go Back
                    </button>
                )}
                {currentPage === 1 && (
                    <button
                        className="btn btn-accent"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={queue.length === 0 || isConverting}
                    >
                        Next
                    </button>
                )}
                {currentPage === 3 && (
                    <button
                        className="btn btn-accent"
                        onClick={startNewSession}
                    >
                        Download More Videos
                    </button>
                )}
            </div>
            {queue.length > 0 && currentPage == 1 && (
                <p className="mt-2">
                    Downloading {queue.length}
                    {queue.length === 1 ? " video" : ` videos`}.
                </p>
            )}
        </main>
    );
}

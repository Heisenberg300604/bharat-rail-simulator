export default function LoadingScreen() {
  return (
    <div className="overlay overlay--loading" role="status">
      <div className="loading">
        <div className="loading__track" aria-hidden>
          <div className="loading__train" />
        </div>
        <p>Laying the track…</p>
      </div>
    </div>
  );
}

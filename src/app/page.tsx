export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">AI Finance Assistant</h1>
      <p className="mt-2 text-sm opacity-70">
        Data layer is ready. Try <code>/api/quotes?symbols=AAPL,MSFT</code>.
      </p>
    </main>
  );
}

type JournalEditorProps = {
  body: string;
  onBodyChange: (body: string) => void;
  onTitleChange: (title: string) => void;
  title: string;
};

export function JournalEditor({
  body,
  onBodyChange,
  onTitleChange,
  title,
}: JournalEditorProps) {
  return (
    <section className="flex flex-1 overflow-y-auto px-5 py-8 md:px-12 lg:px-20 xl:px-32">
      <article className="shadow-card bg-stoic-white mx-auto flex min-h-[620px] w-full max-w-3xl flex-col gap-8 rounded-xl p-6 md:p-10 lg:p-12">
        <input
          aria-label="Journal title"
          className="font-heading placeholder:text-secondary/60 focus-visible:ring-stoic-black/10 w-full rounded-md px-3 py-1 text-4xl leading-tight font-normal italic outline-none placeholder:italic focus-visible:ring-2"
          placeholder="The day's focus..."
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />

        <textarea
          aria-label="Journal body"
          className="text-primary focus-visible:ring-stoic-black/10 min-h-[500px] w-full resize-none rounded-md bg-transparent text-lg leading-8 outline-none focus-visible:ring-2"
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
        />
      </article>
    </section>
  );
}

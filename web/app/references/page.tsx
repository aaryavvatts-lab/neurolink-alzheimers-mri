import type { Metadata } from "next";
import { Page, Prose, Section } from "@/components/ui";

export const metadata: Metadata = { title: "References" };

interface R { n: number; authors: string; year: string; title: string; venue: string; url: string; note: string }

const REFS: R[] = [
  { n: 1, authors: "Marcus, D. S., Wang, T. H., Parker, J., Csernansky, J. G., Morris, J. C., Buckner, R. L.",
    year: "2007", title: "Open Access Series of Imaging Studies (OASIS): cross-sectional MRI data in young, middle aged, nondemented, and demented older adults",
    venue: "Journal of Cognitive Neuroscience, 19(9), 1498–1507",
    url: "https://doi.org/10.1162/jocn.2007.19.9.1498",
    note: "The collection every picture in this project came from." },
  { n: 2, authors: "Yagis, E., Atnafu, S. W., García Seco de Herrera, A., Marzi, C., Scheda, R., Giannelli, M., Tessa, C., Citi, L., Diciotti, S.",
    year: "2021", title: "Effect of data leakage in brain MRI classification using 2D convolutional neural networks",
    venue: "Scientific Reports, 11, 22544",
    url: "https://doi.org/10.1038/s41598-021-01681-w",
    note: "Ran this same test before I did. Found splitting by slice rather than by patient lifted accuracy by about 30 points on OASIS. Also showed that with the labels shuffled at random, a slice split still reported about 96 percent." },
  { n: 3, authors: "Brookshire, G., Kasper, J., Blauch, N. M., et al.",
    year: "2024", title: "Data leakage in deep learning studies of translational EEG",
    venue: "Frontiers in Neuroscience, 18, 1373515",
    url: "https://doi.org/10.3389/fnins.2024.1373515",
    note: "The same mistake in brain wave recordings. They surveyed the field and found most published work does it." },
  { n: 4, authors: "Tampu, I. E., Eklund, A., Haj-Hosseini, N.",
    year: "2022", title: "Inflation of test accuracy due to data leakage in deep learning-based classification of OCT images",
    venue: "Scientific Data, 9, 580",
    url: "https://doi.org/10.1038/s41597-022-01618-6",
    note: "The same mistake again, this time in eye scans." },
  { n: 5, authors: "Islam, J., Zhang, Y.",
    year: "2018", title: "Brain MRI analysis for Alzheimer's disease diagnosis using an ensemble system of deep convolutional neural networks",
    venue: "Brain Informatics, 5, 2",
    url: "https://doi.org/10.1186/s40708-018-0080-3",
    note: "An example of the kind of OASIS work this project is measuring itself against." },
  { n: 6, authors: "Diogo, V. S., Ferreira, H. A., Prata, D.",
    year: "2022", title: "Early diagnosis of Alzheimer's disease using machine learning: a multi-diagnostic, generalizable approach",
    venue: "Alzheimer's Research & Therapy, 14, 107",
    url: "https://doi.org/10.1186/s13195-022-01047-y",
    note: "Careful work on a much bigger pool. About 90 percent balanced accuracy on healthy versus Alzheimer's, but only about 62 percent once a middle group is added. Useful for keeping expectations honest." },
  { n: 7, authors: "Sasse, L., Nicolaisen-Sobesky, E., Dukart, J., et al.",
    year: "2025", title: "Overview of leakage scenarios in supervised machine learning",
    venue: "Journal of Big Data, 12, 87",
    url: "https://doi.org/10.1186/s40537-025-01193-8",
    note: "A catalogue of the ways this goes wrong, beyond the one I ran into." },
  { n: 8, authors: "Apicella, A., Isgrò, F., Prevete, R.",
    year: "2025", title: "Don't push the button! Exploring data leakage risks in machine learning and transfer learning",
    venue: "Artificial Intelligence Review, 58, 190",
    url: "https://doi.org/10.1007/s10462-025-11326-3",
    note: "On how easy tooling makes this mistake easier to make without noticing." },
  { n: 9, authors: "Selvaraju, R. R., Cogswell, M., Das, A., Vedantam, R., Parikh, D., Batra, D.",
    year: "2019", title: "Grad-CAM: visual explanations from deep networks via gradient-based localization",
    venue: "International Journal of Computer Vision, 128, 336–359",
    url: "https://doi.org/10.1007/s11263-019-01228-7",
    note: "The attention pictures here use the simpler version this paper generalises, which needs no gradients and so can run in a browser." },
  { n: 10, authors: "O'Bryant, S. E., Lacritz, L. H., Hall, J., et al.",
    year: "2010", title: "Validation of the new interpretive guidelines for the Clinical Dementia Rating scale sum of boxes score in the National Alzheimer's Coordinating Center database",
    venue: "Archives of Neurology, 67(6), 746–749",
    url: "https://doi.org/10.1001/archneurol.2010.115",
    note: "Background on the rating scale that produced the four labels used here." },
  { n: 11, authors: "LaMontagne, P. J., Benzinger, T. L. S., Morris, J. C., et al.",
    year: "2019", title: "OASIS-3: longitudinal neuroimaging, clinical, and cognitive dataset for normal aging and Alzheimer disease",
    venue: "medRxiv 2019.12.13.19014902",
    url: "https://doi.org/10.1101/2019.12.13.19014902",
    note: "The larger, newer release. A sensible next step for anyone wanting more than 347 people." },
  { n: 12, authors: "Lu, B., Li, H., Chang, Z., et al.",
    year: "2022", title: "A practical Alzheimer's disease classifier via brain imaging-based deep learning on 85,721 samples",
    venue: "Journal of Big Data, 9, 101",
    url: "https://doi.org/10.1186/s40537-022-00650-y",
    note: "What this task looks like with 50,000 participants instead of 347, and tested across sites." },
];

export default function ReferencesPage() {
  return (
    <Page
      eyebrow="References"
      title="Where the claims come from"
      lede="Everything cited here is a real paper I looked up and read the abstract of. Links go to the publisher."
    >
      <Section n="1" title="Papers">
        <ol className="max-w-3xl space-y-7">
          {REFS.map((ref) => (
            <li key={ref.n} id={`r${ref.n}`} className="scroll-mt-24 border-t border-rule pt-5">
              <div className="flex gap-4">
                <span className="font-mono text-[0.8125rem] text-muted">[{ref.n}]</span>
                <div>
                  <p className="p-body">
                    {ref.authors} ({ref.year}).{" "}
                    <a href={ref.url} target="_blank" rel="noopener noreferrer" className="link">
                      {ref.title}
                    </a>
                    . <span className="italic">{ref.venue}</span>.
                  </p>
                  <p className="mt-1.5 p-small">{ref.note}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section n="2" title="Data and tools">
        <div className="max-w-prose">
          <Prose>
            <p>
              The scans come from the OASIS cross-sectional collection, released by the Knight
              Alzheimer Disease Research Center at Washington University in St. Louis. The
              version used here is the slice-by-slice copy that circulates on Kaggle, sorted
              into four folders by dementia rating. Please follow the OASIS terms if you use
              the data yourself, and cite Marcus and colleagues.
            </p>
            <p>
              Built with PyTorch, torchvision, scikit-learn, OpenCV and NumPy on the Python
              side. The site uses Next.js and runs the model with ONNX Runtime Web. Charts
              are hand-drawn SVG with no charting library.
            </p>
          </Prose>
        </div>
      </Section>
    </Page>
  );
}

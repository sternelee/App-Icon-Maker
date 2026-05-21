import { ThemeProvider } from "@app-icon-maker/ui";
import { AppContent } from "@/components/app-content";

function App() {
	return (
		<ThemeProvider>
			<AppContent />
		</ThemeProvider>
	);
}

export default App;

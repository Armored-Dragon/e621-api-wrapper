// This script quickly runs through all of the basic functions of this wrapper to quickly test for any fatal errors under their intended use case.
const account = require(`./dev_account.json`);
const e621 = new (require(`e621-api-wrapper`)).e621(`test`, { base_url: 'http://e621.local', api_key: account.api_key, username: account.username });

// Quickly shutdown if detected to be connecting to e621 main site.
if (e621.base_url === 'https://e621.net') {
	console.log("WARNING!\ne621 'base_url' is set to the https://e621.net page.");
	console.log("This script SHOULD NEVER EVER contact the https://e621.net page.");
	process.exit();
}
else {
	let postcreate_result;
	posts();

	// TODO: Create local file + template for developer api_key and username.

	// ─── POSTS ──────────────────────────────────────────────────────────────────────
	// Test the functions of the posts. You know, the things <99% of the people go to this site for?
	async function posts() {
		console.log('[Posts]', 'Listing');
		await e621.postsList({ limit: 3 });

		console.log('[Posts]', 'Creating');
		postcreate_result = await e621.postsCreate('./node_modules/e621-api-wrapper/images/e621_api_wrapper_logo_(1.0.0).png', 'please_delete test you_should_not_see_this', 'e', 'https://here.com/this.png');

		console.log('[Posts]', 'Voting Up');
		await e621.postsVote(postcreate_result.data.post_id, 'up');

		console.log('[Posts]', 'Voting Down');
		await e621.postsVote(postcreate_result.data.post_id, 'down');

		console.log('[Posts]', 'Favorite');
		await e621.postsFavorite(postcreate_result.data.post_id);

		console.log('[Posts]', 'Unfavorite');
		await e621.postsFavorite(postcreate_result.data.post_id, { favorite: -1 });

		console.log('[Posts]', 'Update');
		await e621.postsUpdate(postcreate_result.data.post_id, { tag_string_diff: '-test new_tag_addition', edit_reason: 'Because I said so', rating: 's', lock_rating: true, lock_notes: true, description: 'This is the new description', source_diff: 'https://notany.com/test.png -https://here.com/this.png' });

		console.log('[Posts]', 'Delete');
		await e621.postsDelete(postcreate_result.data.post_id, { reason: 'This is from the wrapper' });

		console.log('[Posts]', 'Undelete');
		await e621.postsDelete(postcreate_result.data.post_id, { delete_post: false });

		console.log('[Posts]', 'Flag');
		await e621.postsFlagCreate(postcreate_result.data.post_id, 'dnp_artist');

		console.log('[Posts]', 'Flag Listing');
		await e621.postsFlagList({ limit: 3 });

		/* console.log('[Posts]', 'Post Disapprove');
		await e621.postsApprove(postcreate_result.data.post_id, { approve: false });

		console.log('[Posts]', 'Post approve');
		await e621.postsApprove(postcreate_result.data.post_id) */;

		// console.log('[Posts]', 'Destroy');
		// await e621.postsDestroy(postcreate_result.data.post_id);
	}

	// ─── TAGS ───────────────────────────────────────────────────────────────────────
	// Tags on posts.
	async function tags() {
		await e621.tagsList();
		await e621.tagsList({ name_matches: 'poof', category: 'general', limit: 1 });

		await e621.tagAliasesList({ limit: 3 });
	}

	// ─── NOTES ──────────────────────────────────────────────────────────────────────
	// Notes on posts. These aren't too frequent in posts.
	async function notes() {
		await e621.notesList();
		const created_note = await e621.notesCreate(postcreate_result.data.post_id, 5, 5, 20, 20, 'Test Note');
		console.log(created_note.data);
		await e621.notesUpdate(created_note.data.id);
		// await e621.notesDelete();
		await e621.notesRevert();
	}
}